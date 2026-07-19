import { mkdirSync, writeFileSync } from "node:fs";
import { scrapeArthouse } from "./cinemas/arthouse.js";
import { scrapeDff } from "./cinemas/dff.js";
import { scrapeMalsehn } from "./cinemas/malsehn.js";
import { scrapeOrfeos } from "./cinemas/orfeos.js";
import { CINEMAS, PAGES_BASE_URL } from "./config.js";
import { filterScreenings } from "./filter.js";
import { toIcs } from "./ics.js";
import type { Screening } from "./types.js";

function subscribePage(counts: { name: string; file: string; events: number }[]): string {
  const host = new URL(PAGES_BASE_URL).host;
  const rows = counts
    .map(({ name, file, events }) => {
      const webcal = `webcal://${host}${new URL(PAGES_BASE_URL).pathname}/${file}`;
      return `<li><a href="${webcal}">${name}</a> — ${events} Vorstellungen (<a href="${file}" download>.ics</a>)</li>`;
    })
    .join("\n      ");
  return `<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>kino-cal — Frankfurt OV/OmU Kalender</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 40rem; margin: 3rem auto; padding: 0 1rem; line-height: 1.6; }
    li { margin: 0.5rem 0; }
  </style>
</head>
<body>
  <h1>🎬 kino-cal</h1>
  <p>OV/OmU/OmeU-Vorstellungen und deutsche Originale der Arthouse Kinos Frankfurt als abonnierbarer Kalender. Link antippen, um zu abonnieren:</p>
  <ul>
      ${rows}
  </ul>
  <p><small>Aktualisiert: ${new Date().toISOString()} · <a href="https://github.com/sophiamersmann/kino-cal">GitHub</a></small></p>
</body>
</html>
`;
}

async function main() {
  const sources = [
    { name: "arthouse-kinos.de", scrape: scrapeArthouse },
    { name: "dff.film", scrape: scrapeDff },
    { name: "malsehnkino.de", scrape: scrapeMalsehn },
    { name: "orfeos (eventfrog.de)", scrape: scrapeOrfeos },
  ];

  console.log(`Scraping ${sources.map((s) => s.name).join(", ")} …`);
  const results = await Promise.allSettled(sources.map((s) => s.scrape()));

  // One flaky source shouldn't block updates for the others — but if
  // everything failed, fail the run so the previous deploy stays up.
  const all: Screening[] = [];
  results.forEach((result, i) => {
    if (result.status === "fulfilled") {
      console.log(`  ${sources[i]!.name}: ${result.value.length} screenings`);
      all.push(...result.value);
    } else {
      console.error(`  ${sources[i]!.name} FAILED: ${result.reason}`);
    }
  });
  if (all.length === 0) throw new Error("All sources failed");

  const selected = filterScreenings(all);
  console.log(`  ${selected.length} screenings after filtering`);

  mkdirSync("dist", { recursive: true });

  const counts: { name: string; file: string; events: number }[] = [];

  for (const cinema of CINEMAS) {
    const screenings: Screening[] = selected.filter((s) => s.cinema === cinema.id);
    writeFileSync(
      `dist/${cinema.icsFile}`,
      toIcs(screenings, { calendarName: cinema.calendarName }),
    );
    counts.push({ name: cinema.calendarName, file: cinema.icsFile, events: screenings.length });
  }

  writeFileSync("dist/index.html", subscribePage(counts));

  for (const { name, file, events } of counts) {
    console.log(`  dist/${file} — ${events} events (${name})`);
  }
}

await main();
