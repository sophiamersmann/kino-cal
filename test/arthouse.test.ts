import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  enrichScreenings,
  parseFilmDetails,
  parseProgramme,
} from "../src/cinemas/arthouse.js";

const programmeHtml = readFileSync(new URL("./fixtures/arthouse.html", import.meta.url), "utf8");
const detailHtml = readFileSync(new URL("./fixtures/film-detail.html", import.meta.url), "utf8");

describe("parseProgramme", () => {
  const screenings = parseProgramme(programmeHtml);

  it("finds all unique shows on the page", () => {
    // The fixture contains 160 unique data-showid values across all sections
    expect(screenings.length).toBe(160);
  });

  it("dedupes by showId", () => {
    const ids = screenings.map((s) => s.showId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("maps cinema paths to cinema ids", () => {
    const cinemas = new Set(screenings.map((s) => s.cinema));
    expect(cinemas).toEqual(new Set(["harmonie", "cinema", "eldorado"]));
  });

  it("parses a known screening correctly", () => {
    // From the fixture: Die Odyssee, 2026-07-18, 13:30 at Eldorado, OmU, showId 202588
    const s = screenings.find((x) => x.showId === "202588");
    expect(s).toBeDefined();
    expect(s!.title).toBe("Die Odyssee");
    expect(s!.cinema).toBe("eldorado");
    expect(s!.language).toBe("OmU");
    expect(s!.filmUrl).toBe("https://www.arthouse-kinos.de/filme/die-odyssee-50761/");
    expect(s!.bookingUrl).toContain("kinoheld.de");
    // 13:30 Europe/Berlin on 2026-07-18 (CEST, UTC+2) = 11:30 UTC
    expect(s!.start.toISOString()).toBe("2026-07-18T11:30:00.000Z");
  });

  it("detects untagged screenings as German version (language null)", () => {
    const s = screenings.find((x) => x.showId === "22544");
    expect(s).toBeDefined();
    expect(s!.language).toBeNull();
  });

  it("detects OV screenings", () => {
    expect(screenings.some((s) => s.language === "OV")).toBe(true);
  });

  it("never mistakes a trailer link for the film title", () => {
    expect(screenings.every((s) => s.title !== "Trailer ansehen")).toBe(true);
    expect(screenings.every((s) => !s.filmUrl || s.filmUrl.includes("/filme/"))).toBe(true);
  });
});

describe("parseFilmDetails", () => {
  it("extracts metadata from a film detail page", () => {
    const details = parseFilmDetails(detailHtml);
    expect(details.country).toBe("USA");
    expect(details.year).toBe(2026);
    expect(details.originalLanguage).toBe("Englisch");
    expect(details.lengthMinutes).toBe(162);
    expect(details.fsk).toBe("12");
  });

  it("returns empty details for a page without metadata", () => {
    expect(parseFilmDetails("<html><body></body></html>")).toEqual({});
  });
});

describe("enrichScreenings", () => {
  it("merges details into screenings by filmUrl", () => {
    const screenings = parseProgramme(programmeHtml);
    const url = "https://www.arthouse-kinos.de/filme/die-odyssee-50761/";
    const enriched = enrichScreenings(
      screenings,
      new Map([[url, parseFilmDetails(detailHtml)]]),
    );
    const odyssee = enriched.filter((s) => s.filmUrl === url);
    expect(odyssee.length).toBeGreaterThan(0);
    for (const s of odyssee) {
      expect(s.originalLanguage).toBe("Englisch");
      expect(s.lengthMinutes).toBe(162);
    }
    const other = enriched.find((s) => s.filmUrl !== url);
    expect(other?.originalLanguage).toBeUndefined();
  });
});
