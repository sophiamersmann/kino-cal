# kino-cal

Abonnierbare Kalender (`.ics`) für OV/OmU/OmeU-Vorstellungen und deutsche Originale
der [Arthouse Kinos Frankfurt](https://www.arthouse-kinos.de/) (Harmonie, Cinéma, Eldorado).

**Abonnieren:** <https://sophiamersmann.github.io/kino-cal/>

## Wie es funktioniert

Ein täglicher GitHub-Actions-Job scrapt die Programmseite (plus die Detailseite jedes
Films für Originalsprache und Länge), filtert auf Originalfassungen und deutsche
Originale (Synchronfassungen fliegen raus) und veröffentlicht die Kalender über
GitHub Pages:

- `films.ics` — alle drei Kinos kombiniert
- `harmonie.ics`, `cinema.ics`, `eldorado.ics` — einzelne Kinos

Events haben stabile UIDs (kinoheld-Show-IDs), sodass Abonnenten bei jeder
Regenerierung Updates statt Duplikate bekommen.

## Entwicklung

```sh
npm install
npm test          # Parser-/Filter-Tests gegen gespeicherte Fixtures
npm run generate  # scrapt live und schreibt dist/
```
