import * as cheerio from "cheerio";
import { DateTime } from "luxon";
import {
  MALSEHN_KINDERKINO_URL,
  MALSEHN_TICKETS_URL,
  MALSEHN_WEEK_URL,
} from "../config.js";
import type { Screening } from "../types.js";

/**
 * Mal Seh'n publishes its week programme on malsehnkino.de (rich metadata,
 * no booking links) and sells tickets on kinotickets.express (per-show
 * booking links, no metadata). We scrape the week page and attach booking
 * links by matching on date + time — the cinema has a single screen, so a
 * datetime uniquely identifies a show.
 */

interface WeekEntry {
  title: string;
  movieId: string | undefined;
  start: DateTime;
  language: string | null;
  lengthMinutes?: number;
  country?: string;
}

/** Key for matching a screening across the two sites: "DD.MM|HH:MM" */
function matchKey(day: string, month: string, time: string): string {
  return `${day}.${month}|${time.padStart(5, "0")}`;
}

export function parseMalsehnWeek(html: string): WeekEntry[] {
  const $ = cheerio.load(html);
  const entries: WeekEntry[] = [];

  $(".contentBlock").each((_, blockEl) => {
    const block = $(blockEl);
    const dateMatch = block
      .find(".blockTitleLeft")
      .first()
      .text()
      .match(/(\d{2})\.(\d{2})\.(\d{4})/);
    if (!dateMatch) return;
    const [, dd, mm, yyyy] = dateMatch;

    block.find(".entry").each((_, entryEl) => {
      const entry = $(entryEl);

      const timeMatch = entry.find("p.time").first().text().match(/(\d{1,2}):(\d{2})/);
      if (!timeMatch) return;
      const time = `${timeMatch[1]!.padStart(2, "0")}:${timeMatch[2]}`;

      const link = entry.find("h2.overview a").first();
      const title = link.text().trim();
      if (!title) return;
      const movieId = link.attr("href")?.match(/movieID=(\d+)/)?.[1];

      const start = DateTime.fromISO(`${yyyy}-${mm}-${dd}T${time}`, {
        zone: "Europe/Berlin",
      });
      if (!start.isValid) return;

      // Language note like "(arabisch / französische OmU)" — usually empty
      const note = entry.find("h3").first().text();
      const language = note.match(/\b(OmU|OmeU|OV|OF)\b/)?.[1] ?? null;

      // Description: "Dokumentarfilm von X, Deutschland / Österreich 2025, 95 Min."
      const description = entry.find("p.description").first().text();
      const countryMatch = description.match(/,\s*([A-Za-zÄÖÜäöüß/ -]+?)\s+(\d{4})\s*,/);
      const lengthMatch = description.match(/(\d+)\s*Min/);

      entries.push({
        title,
        movieId,
        start,
        language,
        lengthMinutes: lengthMatch?.[1] ? Number(lengthMatch[1]) : undefined,
        country: countryMatch?.[1]?.trim(),
      });
    });
  });

  return entries;
}

/** kinotickets.express: map "DD.MM|HH:MM" → booking path (/frankfurt_malsehn/booking/<id>) */
export function parseMalsehnTickets(html: string): Map<string, string> {
  const $ = cheerio.load(html);
  const byDatetime = new Map<string, string>();

  $("a[href*='/booking/']").each((_, aEl) => {
    const a = $(aEl);
    const href = a.attr("href");
    const timeMatch = a.text().match(/(\d{1,2}):(\d{2})/);
    // The enclosing <li> holds the date ("Mi" / "22.07.") next to the time links
    const dateMatch = a
      .closest("li")
      .text()
      .match(/(\d{2})\.(\d{2})\./);
    if (!href || !timeMatch || !dateMatch) return;
    byDatetime.set(
      matchKey(dateMatch[1]!, dateMatch[2]!, `${timeMatch[1]}:${timeMatch[2]}`),
      href,
    );
  });

  return byDatetime;
}

/**
 * Kinderkino section: set of "movieID|DD.MM|HH:MM"-ish exclusion keys.
 * When no children's programme is scheduled the page says
 * "Zur Zeit keine Vorstellungen" and this returns an empty set.
 */
export function parseMalsehnKinderkino(html: string): Set<string> {
  const excluded = new Set<string>();
  for (const entry of parseMalsehnWeek(html)) {
    if (entry.movieId) excluded.add(entry.movieId);
  }
  return excluded;
}

export function buildScreenings(
  week: WeekEntry[],
  bookingByDatetime: Map<string, string>,
  kinderkinoMovieIds: Set<string>,
): Screening[] {
  const byShowId = new Map<string, Screening>();

  for (const entry of week) {
    if (entry.movieId && kinderkinoMovieIds.has(entry.movieId)) continue;

    const key = matchKey(
      entry.start.toFormat("dd"),
      entry.start.toFormat("MM"),
      entry.start.toFormat("HH:mm"),
    );
    const bookingPath = bookingByDatetime.get(key);
    // Booking id when matched; otherwise a synthetic-but-stable fallback
    const showId = bookingPath
      ? `malsehn-${bookingPath.split("/").at(-1)}`
      : `malsehn-${entry.movieId ?? "x"}-${entry.start.toFormat("yyyyMMdd'T'HHmm")}`;
    if (byShowId.has(showId)) continue;

    byShowId.set(showId, {
      cinema: "malsehn",
      title: entry.title,
      start: entry.start.toJSDate(),
      showId,
      bookingUrl: bookingPath ? `https://kinotickets.express${bookingPath}` : MALSEHN_TICKETS_URL,
      language: entry.language,
      lengthMinutes: entry.lengthMinutes,
      country: entry.country,
    });
  }

  return [...byShowId.values()];
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "user-agent": "kino-cal (github.com/sophiamersmann/kino-cal)" },
  });
  if (!res.ok) throw new Error(`GET ${url} → ${res.status}`);
  return res.text();
}

export async function scrapeMalsehn(): Promise<Screening[]> {
  const week = parseMalsehnWeek(await fetchText(MALSEHN_WEEK_URL));

  // Booking links and the Kinderkino section are nice-to-haves — losing
  // them shouldn't lose the screenings themselves.
  let bookings = new Map<string, string>();
  try {
    bookings = parseMalsehnTickets(await fetchText(MALSEHN_TICKETS_URL));
  } catch (err) {
    console.warn(`Mal Seh'n ticket links unavailable: ${err}`);
  }
  let kinderkino = new Set<string>();
  try {
    kinderkino = parseMalsehnKinderkino(await fetchText(MALSEHN_KINDERKINO_URL));
  } catch (err) {
    console.warn(`Mal Seh'n Kinderkino page unavailable: ${err}`);
  }

  return buildScreenings(week, bookings, kinderkino);
}
