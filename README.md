# kino-cal

Abonnierbare Kalender (`.ics`) für OV/OmU-Vorstellungen ausgewählter Frankfurter
Programmkinos — ein Kalender pro Kino.

**Abonnieren:** <https://sophiamersmann.github.io/kino-cal/>

| Kalender | Kino | Quelle |
| --- | --- | --- |
| `harmonie.ics` | Harmonie | arthouse-kinos.de |
| `cinema.ics` | Cinéma | arthouse-kinos.de |
| `eldorado.ics` | Eldorado | arthouse-kinos.de |
| `dff.ics` | Kino des DFF | dff.film |
| `malsehn.ics` | Mal Seh'n | malsehnkino.de + kinotickets.express |
| `orfeos.ics` | Orfeos Erben | eventfrog.de |

## Wie es funktioniert

Ein täglicher GitHub-Actions-Job scrapt die Programmseiten und veröffentlicht die
Kalender über GitHub Pages. Ausgewählt werden Originalfassungen (OV/OmU/OmeU)
und deutschsprachige Originale; Synchronfassungen und Kinderkino fliegen raus.
Je nach Kino heißt das:

- **Arthouse Kinos** (Harmonie, Cinéma, Eldorado): Sprachfassung pro Vorstellung
  von der Programmseite; für ungetaggte Filme entscheidet die Originalsprache von
  der Film-Detailseite (Fallback: Produktionsland).
- **DFF**: alles steht inline im Programm (OF/OmU/OmeU/DF); DF-Kopien werden
  ausgeschlossen, Kinderkino ebenso.
- **Mal Seh'n**: zeigt ohnehin nur Originalfassungen — alles außer Kinderkino
  kommt rein. Buchungslinks und Titel kommen von kinotickets.express
  (Wochenprogramm und Tickets werden per Datum + Uhrzeit gematcht).
- **Orfeos Erben**: Programm läuft komplett über Eventfrog (schema.org-Daten
  der Event-Seiten); keine Sprachinfos verfügbar, daher kommt alles rein —
  inklusive der Cinéma-&-Diner-Events.

Events haben stabile UIDs (IDs der Ticketsysteme), sodass Abonnenten bei jeder
Regenerierung Updates statt Duplikate bekommen. Vorstellungen erscheinen so weit
im Voraus, wie die Kinos sie veröffentlichen (Arthouse: rollende Woche plus
Specials, DFF: ~6 Wochen, Mal Seh'n: aktuelle Woche, Orfeos: aktueller Filmlauf).

## Entwicklung

```sh
npm install
npm test          # Parser-/Filter-Tests gegen gespeicherte Fixtures
npm run generate  # scrapt live und schreibt dist/
```

Neues Kino hinzufügen: Scraper-Modul in `src/cinemas/` (liefert `Screening[]`),
Eintrag in der Registry in `src/config.ts`, Quelle in `src/main.ts` registrieren —
Kalender und Eintrag auf der Abo-Seite entstehen automatisch.
