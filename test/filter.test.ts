import { describe, expect, it } from "vitest";
import { defaultFilter, filterScreenings } from "../src/filter.js";
import type { Screening } from "../src/types.js";

function screening(overrides: Partial<Screening>): Screening {
  return {
    cinema: "harmonie",
    title: "Test Film",
    start: new Date("2026-07-18T18:00:00Z"),
    showId: "1",
    bookingUrl: "https://example.com",
    language: null,
    ...overrides,
  };
}

describe("defaultFilter", () => {
  it("keeps OV/OmU/OmeU screenings regardless of metadata", () => {
    expect(defaultFilter(screening({ language: "OV" }))).toBe(true);
    expect(defaultFilter(screening({ language: "OmU" }))).toBe(true);
    expect(defaultFilter(screening({ language: "OmeU", originalLanguage: "Französisch" }))).toBe(
      true,
    );
  });

  it("keeps untagged German-language originals", () => {
    expect(defaultFilter(screening({ originalLanguage: "Deutsch" }))).toBe(true);
  });

  it("excludes untagged foreign-language films (dubs)", () => {
    expect(defaultFilter(screening({ originalLanguage: "Englisch", country: "USA" }))).toBe(false);
  });

  it("falls back to production country when Originalsprache is missing", () => {
    expect(defaultFilter(screening({ country: "Deutschland" }))).toBe(true);
    expect(defaultFilter(screening({ country: "Österreich, Deutschland" }))).toBe(true);
    expect(defaultFilter(screening({ country: "USA" }))).toBe(false);
  });

  it("excludes untagged screenings without any metadata", () => {
    expect(defaultFilter(screening({}))).toBe(false);
  });

  it("filters a list", () => {
    const list = [
      screening({ showId: "1", language: "OmU" }),
      screening({ showId: "2", originalLanguage: "Englisch" }),
      screening({ showId: "3", originalLanguage: "Deutsch" }),
    ];
    expect(filterScreenings(list).map((s) => s.showId)).toEqual(["1", "3"]);
  });
});
