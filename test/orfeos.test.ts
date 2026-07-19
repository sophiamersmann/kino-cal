import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  parseOrfeosEvent,
  parseOrfeosGroup,
  parseOrfeosLocation,
} from "../src/cinemas/orfeos.js";

const locationHtml = readFileSync(
  new URL("./fixtures/orfeos-location.html", import.meta.url),
  "utf8",
);
const groupHtml = readFileSync(new URL("./fixtures/orfeos-group.html", import.meta.url), "utf8");
const eventHtml = readFileSync(new URL("./fixtures/orfeos-event.html", import.meta.url), "utf8");

describe("parseOrfeosLocation", () => {
  it("collects deduped event links from the listing", () => {
    const { groups, singles } = parseOrfeosLocation(locationHtml);
    // Two series are on the fixture page: Amore und Basta! and Cinéma & Diner
    expect(groups).toEqual([
      "https://eventfrog.de/de/p/gruppen/amore-und-basta-7472264149784889067.html",
      "https://eventfrog.de/de/p/gruppen/cinema-diner-a-la-surprise-7116418126510518554.html",
    ]);
    expect(singles).toEqual([]);
  });
});

describe("parseOrfeosGroup", () => {
  it("expands a series into its individual event links", () => {
    const urls = parseOrfeosGroup(groupHtml);
    expect(urls.length).toBe(8);
    expect(urls.every((u) => u.startsWith("https://eventfrog.de/de/p/"))).toBe(true);
    expect(urls.every((u) => !u.includes("/gruppen/"))).toBe(true);
  });
});

describe("parseOrfeosEvent", () => {
  it("parses the schema.org Event ld+json", () => {
    const s = parseOrfeosEvent(eventHtml);
    expect(s).not.toBeNull();
    expect(s!.cinema).toBe("orfeos");
    expect(s!.title).toBe("Amore und Basta!");
    expect(s!.showId).toBe("orfeos-7472264011486099662");
    expect(s!.bookingUrl).toContain("eventfrog.de");
    // 2026-07-30 20:00 +02:00 = 18:00 UTC; ends 21:45 → 105 minutes
    expect(s!.start.toISOString()).toBe("2026-07-30T18:00:00.000Z");
    expect(s!.lengthMinutes).toBe(105);
    expect(s!.language).toBeNull();
  });

  it("returns null for cancelled events", () => {
    const cancelled = eventHtml.replace(
      "https://schema.org/EventScheduled",
      "https://schema.org/EventCancelled",
    );
    expect(parseOrfeosEvent(cancelled)).toBeNull();
  });

  it("returns null when no Event ld+json exists", () => {
    expect(parseOrfeosEvent("<html><body></body></html>")).toBeNull();
  });
});
