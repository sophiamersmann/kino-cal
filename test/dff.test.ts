import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseDffProgramme } from "../src/cinemas/dff.js";
import { defaultFilter } from "../src/filter.js";

const html = readFileSync(new URL("./fixtures/dff.html", import.meta.url), "utf8");

describe("parseDffProgramme", () => {
  const screenings = parseDffProgramme(html);

  it("finds all screenings except Kinderkino", () => {
    // The fixture has 102 datasets, 17 of which are Kinderkino
    expect(screenings.length).toBe(85);
  });

  it("assigns unique, namespaced showIds", () => {
    const ids = screenings.map((s) => s.showId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => id.startsWith("dff-"))).toBe(true);
  });

  it("parses a known screening correctly", () => {
    // From the fixture: Bashu, der kleine Fremde, 2026-07-18 18:00, OmU
    const s = screenings.find((x) => x.showId === "dff-3564471067");
    expect(s).toBeDefined();
    expect(s!.title).toBe("Bashu, der kleine Fremde");
    expect(s!.cinema).toBe("dff");
    expect(s!.language).toBe("OmU");
    expect(s!.country).toBe("Iran");
    expect(s!.lengthMinutes).toBe(120);
    expect(s!.bookingUrl).toContain("booking.cinetixx.de");
    expect(s!.filmUrl).toContain("bahram-beyzai");
    // 18:00 Europe/Berlin on 2026-07-18 (CEST, UTC+2) = 16:00 UTC
    expect(s!.start.toISOString()).toBe("2026-07-18T16:00:00.000Z");
  });

  it("maps OF to OV and keeps Om…U variants as-is", () => {
    expect(screenings.some((s) => s.language === "OV")).toBe(true);
    expect(screenings.some((s) => s.language === "OmeU")).toBe(true);
    expect(screenings.some((s) => s.language === "OmseU")).toBe(true);
    expect(screenings.every((s) => s.language !== "OF")).toBe(true);
  });

  it("marks DF prints as dubbed", () => {
    const dubs = screenings.filter((s) => s.dubbed);
    expect(dubs.length).toBeGreaterThan(0);
    expect(dubs.every((s) => s.language === null)).toBe(true);
  });

  it("excludes the children's programme", () => {
    expect(screenings.every((s) => !/Tafiti/i.test(s.title))).toBe(true);
  });
});

describe("DFF screenings through the default filter", () => {
  const selected = parseDffProgramme(html).filter(defaultFilter);

  it("keeps subtitled originals and German originals, drops dubs", () => {
    expect(selected.length).toBe(69);
    expect(selected.every((s) => !s.dubbed)).toBe(true);
    // German original without a language tag (Wim Wenders, BRD) stays in
    expect(selected.some((s) => s.title === "IM LAUF DER ZEIT")).toBe(true);
  });

  it("drops non-screening products like season tickets", () => {
    expect(selected.every((s) => !/DAUERKARTE/i.test(s.title))).toBe(true);
  });
});
