import * as cheerio from "cheerio";
import { DateTime } from "luxon";
import { ARTHOUSE_BASE_URL, ARTHOUSE_PROGRAMME_URL } from "../config.js";
import type { FilmDetails, Language, Screening } from "../types.js";

const CINEMA_PATHS: Record<string, string> = {
  "kino-frankfurt-am-main/harmonie-theater-frankfurt": "harmonie",
  "kino-frankfurt-am-main/cinema-frankfurt": "cinema",
  "kino-frankfurt-am-main/eldorado-arthouse-kino": "eldorado",
};

const LANGUAGES: Language[] = ["OV", "OmU", "OmeU"];

/** Parse the programm-tickets page into screenings, deduped by showId. */
export function parseProgramme(html: string): Screening[] {
  const $ = cheerio.load(html);
  const byShowId = new Map<string, Screening>();

  $(".movie-item[data-date]").each((_, movieEl) => {
    const movie = $(movieEl);
    const date = movie.attr("data-date"); // ISO YYYY-MM-DD
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return;

    // The first a[title] may be a trailer link ("Trailer ansehen") — take the
    // film detail link and the caption text instead.
    const link = movie.find('a[href^="/filme/"]').first();
    const title =
      movie.find(".movie-item-caption span").first().text().trim() ||
      link.attr("title")?.trim();
    if (!title) return;
    const href = link.attr("href");
    const filmUrl = href ? new URL(href, ARTHOUSE_BASE_URL).href : undefined;

    movie.find("label.movie-item-showtime > a[data-showid]").each((_, showEl) => {
      const show = $(showEl);
      const showId = show.attr("data-showid");
      const cinemaPath = show.attr("data-cinema-path") ?? "";
      const cinema = CINEMA_PATHS[cinemaPath];
      const time = show.find(".movie-itemshowtime-linktext").text().trim();
      if (!showId || !cinema || !/^\d{1,2}:\d{2}$/.test(time)) return;
      if (byShowId.has(showId)) return;

      const start = DateTime.fromISO(`${date}T${time.padStart(5, "0")}`, {
        zone: "Europe/Berlin",
      });
      if (!start.isValid) return;

      const classes = show.attr("class") ?? "";
      const language =
        LANGUAGES.find((lang) => classes.includes(`movie-item-showing-lang-${lang}`)) ?? null;

      byShowId.set(showId, {
        cinema,
        title,
        start: start.toJSDate(),
        showId,
        bookingUrl: show.attr("href") ?? "",
        filmUrl,
        language,
      });
    });
  });

  return [...byShowId.values()];
}

/**
 * Parse a film detail page (/filme/<slug>/). Metadata lives in a description
 * paragraph like "USA 2026; Regie: Christopher Nolan; Originalsprache: Englisch"
 * and an info line like "Ab 12 Jahren  |  162 Minuten".
 */
export function parseFilmDetails(html: string): FilmDetails {
  const $ = cheerio.load(html);
  const details: FilmDetails = {};

  $(".programme-details-info-description-text-container p").each((_, el) => {
    const text = $(el).text();
    const langMatch = text.match(/Originalsprache:\s*([^;]+)/);
    if (langMatch?.[1]) details.originalLanguage = langMatch[1].trim();
    const countryMatch = text.match(/^\s*([^;]+?)\s+(\d{4})\s*;/);
    if (countryMatch?.[1] && countryMatch[2]) {
      details.country = countryMatch[1].trim();
      details.year = Number(countryMatch[2]);
    }
  });

  const additional = $(".programme-details-info-additional").text();
  const lengthMatch = additional.match(/(\d+)\s*Minuten/);
  if (lengthMatch?.[1]) details.lengthMinutes = Number(lengthMatch[1]);
  const fskMatch = additional.match(/Ab\s+(\d+)\s+Jahren/i);
  if (fskMatch?.[1]) details.fsk = fskMatch[1];

  return details;
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "user-agent": "kino-cal (github.com/sophiamersmann/kino-cal)" },
  });
  if (!res.ok) throw new Error(`GET ${url} → ${res.status}`);
  return res.text();
}

/** Fetch film details for all unique film URLs, with limited concurrency. */
export async function fetchAllFilmDetails(
  filmUrls: string[],
  concurrency = 5,
): Promise<Map<string, FilmDetails>> {
  const unique = [...new Set(filmUrls)];
  const results = new Map<string, FilmDetails>();
  let next = 0;

  await Promise.all(
    Array.from({ length: Math.min(concurrency, unique.length) }, async () => {
      while (next < unique.length) {
        const url = unique[next++]!;
        try {
          results.set(url, parseFilmDetails(await fetchText(url)));
        } catch (err) {
          console.warn(`Skipping film details for ${url}: ${err}`);
        }
      }
    }),
  );

  return results;
}

/** Merge film details into screenings (by filmUrl). */
export function enrichScreenings(
  screenings: Screening[],
  detailsByUrl: Map<string, FilmDetails>,
): Screening[] {
  return screenings.map((screening) => {
    const details = screening.filmUrl ? detailsByUrl.get(screening.filmUrl) : undefined;
    if (!details) return screening;
    return {
      ...screening,
      lengthMinutes: details.lengthMinutes,
      fsk: details.fsk,
      country: details.country,
      originalLanguage: details.originalLanguage,
    };
  });
}

/** Scrape the live site: programme page + all unique film detail pages. */
export async function scrapeArthouse(): Promise<Screening[]> {
  const screenings = parseProgramme(await fetchText(ARTHOUSE_PROGRAMME_URL));
  const filmUrls = screenings.flatMap((s) => (s.filmUrl ? [s.filmUrl] : []));
  const details = await fetchAllFilmDetails(filmUrls);
  return enrichScreenings(screenings, details);
}
