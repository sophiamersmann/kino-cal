import * as cheerio from "cheerio";
import { DateTime } from "luxon";
import { DFF_PROGRAMME_URL } from "../config.js";
import type { Screening } from "../types.js";

/**
 * The DFF programme is server-rendered by a WordPress plugin embedding
 * cinetixx ticketing data: day blocks (`.cinetixxday-wrapper`) with a date
 * heading, each containing screenings (`.cinetixxdataset`) that carry time,
 * titles, an info line ("Iran 1989. R: … 120 Min. DCP. OmU") and a booking
 * button whose onclick holds the cinetixx URL with a stable showId.
 */
export function parseDffProgramme(html: string): Screening[] {
  const $ = cheerio.load(html);
  const byShowId = new Map<string, Screening>();

  $(".cinetixxday-wrapper").each((_, dayEl) => {
    const day = $(dayEl);
    const dateText = day.find(".cinetixxdateseperator").first().text();
    const dateMatch = dateText.match(/(\d{2})\.(\d{2})\.(\d{4})/);
    if (!dateMatch) return;
    const [, dd, mm, yyyy] = dateMatch;

    day.find(".cinetixxdataset").each((_, setEl) => {
      const dataset = $(setEl);

      const timeMatch = dataset
        .find(".cinetixx-content-value")
        .first()
        .text()
        .match(/(\d{1,2}):(\d{2})/);
      if (!timeMatch) return;

      // The booking URL lives in the ticket button's onclick handler
      const onclick = dataset.find("button[onclick*='booking.cinetixx.de']").attr("onclick") ?? "";
      const bookingUrl = onclick.match(/https:\/\/booking\.cinetixx\.de[^'"]*/)?.[0];
      const showIdMatch = bookingUrl?.match(/[?&]showId=(\d+)/);
      if (!bookingUrl || !showIdMatch) return;
      // Namespaced so cinetixx ids can never collide with kinoheld ids
      const showId = `dff-${showIdMatch[1]}`;
      if (byShowId.has(showId)) return;

      const info = dataset.find("div.textshort").first();
      const infoText = info.text();

      // Skip children's programme
      if (/Filmreihe:\s*Kinderkino/i.test(infoText)) return;

      // German display title in <strong>, all-caps original title in <h4>
      const originalTitle = dataset.find("h4").first().text().trim();
      const title = info.find("strong").first().text().trim() || originalTitle;
      if (!title) return;

      // "Zur Filmreihe/Veranstaltung" link, when the screening belongs to one
      const seriesUrl = dataset.find("a[href^='https://www.dff.film/']").first().attr("href");

      const start = DateTime.fromISO(
        `${yyyy}-${mm}-${dd}T${timeMatch[1]!.padStart(2, "0")}:${timeMatch[2]}`,
        { zone: "Europe/Berlin" },
      );
      if (!start.isValid) return;

      // Info line: "<Country> <Year>. R: <Director>. … <N> Min. <Format>. <Tag>"
      const countryMatch = infoText.match(/([A-Za-zÄÖÜäöüß/ -]+?)\s+(\d{4})\.\s/);
      const lengthMatch = infoText.match(/(\d+)\s*Min\./);
      // OF = Originalfassung, Om…U = subtitled original (OmU/OmeU/OmseU/…),
      // DF or "Deutsche Fassung" = dubbed print
      const langToken = infoText.match(/\b(OF|DF|Om\w*U)\b/g)?.at(-1);
      const dubbed = langToken === "DF" || /Deutsche Fassung/.test(infoText);
      const language = langToken === "OF" ? "OV" : langToken?.startsWith("Om") ? langToken : null;

      byShowId.set(showId, {
        cinema: "dff",
        title,
        start: start.toJSDate(),
        showId,
        bookingUrl,
        filmUrl: seriesUrl,
        language,
        dubbed,
        lengthMinutes: lengthMatch?.[1] ? Number(lengthMatch[1]) : undefined,
        country: countryMatch?.[1]?.trim(),
      });
    });
  });

  return [...byShowId.values()];
}

export async function scrapeDff(): Promise<Screening[]> {
  const res = await fetch(DFF_PROGRAMME_URL, {
    headers: { "user-agent": "kino-cal (github.com/sophiamersmann/kino-cal)" },
  });
  if (!res.ok) throw new Error(`GET ${DFF_PROGRAMME_URL} → ${res.status}`);
  return parseDffProgramme(await res.text());
}
