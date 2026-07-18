import { mkdirSync, writeFileSync } from "node:fs";
import { scrapeArthouse } from "./cinemas/arthouse.js";
import {
  CINEMAS,
  COMBINED_CALENDAR_NAME,
  COMBINED_ICS_FILE,
  PAGES_BASE_URL,
} from "./config.js";
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
  console.log("Scraping arthouse-kinos.de …");
  const all = await scrapeArthouse();
  console.log(`  ${all.length} screenings scraped`);

  const selected = filterScreenings(all);
  console.log(`  ${selected.length} screenings after filtering`);

  mkdirSync("dist", { recursive: true });

  const counts: { name: string; file: string; events: number }[] = [];

  writeFileSync(
    `dist/${COMBINED_ICS_FILE}`,
    toIcs(selected, { calendarName: COMBINED_CALENDAR_NAME, cinemaInTitle: true }),
  );
  counts.push({ name: COMBINED_CALENDAR_NAME, file: COMBINED_ICS_FILE, events: selected.length });

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
