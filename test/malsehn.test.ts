import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  buildScreenings,
  parseMalsehnKinderkino,
  parseMalsehnTickets,
  parseMalsehnWeek,
} from "../src/cinemas/malsehn.js";
import { selectionFilter } from "../src/filter.js";

const weekHtml = readFileSync(new URL("./fixtures/malsehn-week.html", import.meta.url), "utf8");
const ticketsHtml = readFileSync(
  new URL("./fixtures/malsehn-tickets.html", import.meta.url),
  "utf8",
);
const kinderHtml = readFileSync(
  new URL("./fixtures/malsehn-kinder.html", import.meta.url),
  "utf8",
);

describe("parseMalsehnWeek", () => {
  const entries = parseMalsehnWeek(weekHtml);

  it("finds all screenings of the week", () => {
    expect(entries.length).toBe(21);
  });

  it("parses a known screening correctly", () => {
    // Saturday 2026-07-18, 18:00: TÖCHTER EUROPAS, Deutschland 2023, 80 Min.
    const s = entries[0]!;
    expect(s.title).toBe("TÖCHTER EUROPAS");
    expect(s.movieId).toBe("108132");
    expect(s.country).toBe("Deutschland");
    expect(s.lengthMinutes).toBe(80);
    // 18:00 Europe/Berlin (CEST, UTC+2) = 16:00 UTC
    expect(s.start.toUTC().toISO()).toBe("2026-07-18T16:00:00.000Z");
  });

  it("reads the language note when present", () => {
    // DIRECT ACTION: "(arabisch / französische OmU)"
    const s = entries.find((x) => x.title === "DIRECT ACTION");
    expect(s?.language).toBe("OmU");
    // German documentaries carry no note
    expect(entries[0]!.language).toBeNull();
  });
});

describe("parseMalsehnTickets", () => {
  it("maps datetimes to booking paths", () => {
    const tickets = parseMalsehnTickets(ticketsHtml);
    expect(tickets.size).toBeGreaterThan(20);
    expect(tickets.get("18.07|18:00")).toBe("/frankfurt_malsehn/booking/18281");
  });
});

describe("parseMalsehnKinderkino", () => {
  it("returns nothing when no children's programme is scheduled", () => {
    expect(parseMalsehnKinderkino(kinderHtml).size).toBe(0);
  });

  it("collects movie ids from an active listing", () => {
    const active = `
      <div class="contentBlock">
        <h2 class="blockTitleLeft">Samstag, 18.07.2026</h2>
        <div class="entry">
          <p class="time">15:00</p>
          <h2 class="overview"><a href="index.php?section=Kinderkino&movieID=999&date=2026-07-18&time=15:00">DAS KINDERFILMCHEN</a></h2>
          <h3></h3>
          <p class="description">von Wer Auch Immer, Deutschland 2024, 70 Min.</p>
        </div>
      </div>`;
    expect(parseMalsehnKinderkino(active)).toEqual(new Set(["999"]));
  });
});

describe("buildScreenings", () => {
  const week = parseMalsehnWeek(weekHtml);
  const tickets = parseMalsehnTickets(ticketsHtml);

  it("attaches booking links by date + time", () => {
    const screenings = buildScreenings(week, tickets, new Set());
    expect(screenings.length).toBe(21);
    expect(screenings.every((s) => s.bookingUrl.includes("/booking/"))).toBe(true);
    expect(screenings.every((s) => s.showId.startsWith("malsehn-"))).toBe(true);
    expect(new Set(screenings.map((s) => s.showId)).size).toBe(21);
  });

  it("falls back to the generic ticket page when nothing matches", () => {
    const screenings = buildScreenings(week, new Map(), new Set());
    expect(screenings.length).toBe(21);
    const s = screenings[0]!;
    expect(s.bookingUrl).toBe("https://kinotickets.express/frankfurt_malsehn");
    expect(s.showId).toBe("malsehn-108132-20260718T1800");
  });

  it("excludes Kinderkino screenings by movie id", () => {
    const someId = week[0]!.movieId!;
    const screenings = buildScreenings(week, tickets, new Set([someId]));
    expect(screenings.length).toBeLessThan(21);
    expect(screenings.every((s) => !s.title.includes("TÖCHTER EUROPAS"))).toBe(true);
  });

  it("passes the selection filter in full (include-all rule for malsehn)", () => {
    const screenings = buildScreenings(week, tickets, new Set());
    expect(screenings.filter(selectionFilter).length).toBe(21);
  });
});
