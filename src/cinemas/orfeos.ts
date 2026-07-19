import * as cheerio from "cheerio";
import { DateTime } from "luxon";
import { ORFEOS_LOCATION_URL } from "../config.js";
import type { Screening } from "../types.js";

const EVENTFROG_BASE_URL = "https://eventfrog.de";

/**
 * Orfeos Erben has no programme on its own site — everything is ticketed
 * through Eventfrog. The location page lists upcoming events; series
 * ("Eventserie", e.g. a film's multi-week run) link to a group page whose
 * dates table links one individual event page per screening. Individual
 * event pages carry a schema.org Event ld+json with exact start/end times.
 */

function eventLinks($: cheerio.CheerioAPI): { groups: string[]; singles: string[] } {
  const groups = new Set<string>();
  const singles = new Set<string>();
  $("a[href^='/de/p/']").each((_, el) => {
    const href = $(el).attr("href");
    if (!href?.endsWith(".html")) return;
    (href.includes("/gruppen/") ? groups : singles).add(EVENTFROG_BASE_URL + href);
  });
  return { groups: [...groups], singles: [...singles] };
}

/** Location page → group-page URLs and directly linked event URLs */
export function parseOrfeosLocation(html: string): { groups: string[]; singles: string[] } {
  const $ = cheerio.load(html);
  const listing = $("#location-event-listing");
  return eventLinks(cheerio.load(listing.html() ?? ""));
}

/** Group page → individual event URLs from the dates table */
export function parseOrfeosGroup(html: string): string[] {
  return eventLinks(cheerio.load(html)).singles;
}

/** Individual event page → Screening (null for cancelled/unparseable events) */
export function parseOrfeosEvent(html: string): Screening | null {
  const $ = cheerio.load(html);

  for (const el of $("script[type='application/ld+json']")) {
    let data: unknown;
    try {
      data = JSON.parse($(el).text());
    } catch {
      continue;
    }
    const items = Array.isArray(data) ? data : [data];
    for (const item of items) {
      const event = item as {
        "@type"?: string;
        name?: string;
        startDate?: string;
        endDate?: string;
        eventStatus?: string;
        url?: string;
      };
      if (event["@type"] !== "Event" || !event.name || !event.startDate || !event.url) continue;
      if (event.eventStatus && !event.eventStatus.includes("EventScheduled")) return null;

      const start = DateTime.fromISO(event.startDate);
      if (!start.isValid) continue;
      const end = event.endDate ? DateTime.fromISO(event.endDate) : null;
      const id = event.url.match(/-(\d+)\.html$/)?.[1];
      if (!id) continue;

      return {
        cinema: "orfeos",
        title: event.name.trim(),
        start: start.toJSDate(),
        showId: `orfeos-${id}`,
        bookingUrl: event.url,
        language: null,
        lengthMinutes:
          end?.isValid && end > start ? Math.round(end.diff(start, "minutes").minutes) : undefined,
      };
    }
  }

  return null;
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "user-agent": "kino-cal (github.com/sophiamersmann/kino-cal)" },
  });
  if (!res.ok) throw new Error(`GET ${url} → ${res.status}`);
  return res.text();
}

export async function scrapeOrfeos(): Promise<Screening[]> {
  const { groups, singles } = parseOrfeosLocation(await fetchText(ORFEOS_LOCATION_URL));

  const eventUrls = new Set<string>(singles);
  for (const groupUrl of groups) {
    for (const url of parseOrfeosGroup(await fetchText(groupUrl))) eventUrls.add(url);
  }

  const byShowId = new Map<string, Screening>();
  for (const url of eventUrls) {
    try {
      const screening = parseOrfeosEvent(await fetchText(url));
      if (screening && !byShowId.has(screening.showId)) {
        byShowId.set(screening.showId, screening);
      }
    } catch (err) {
      console.warn(`Skipping Orfeos event ${url}: ${err}`);
    }
  }

  return [...byShowId.values()];
}
