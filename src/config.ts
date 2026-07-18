export interface Cinema {
  id: string;
  name: string;
  address: string;
  /** Output filename of this cinema's individual calendar */
  icsFile: string;
  /** Calendar display name (X-WR-CALNAME) */
  calendarName: string;
}

export const CINEMAS: Cinema[] = [
  {
    id: "harmonie",
    name: "Harmonie",
    address: "Dreieichstraße 54, 60594 Frankfurt am Main",
    icsFile: "harmonie.ics",
    calendarName: "Harmonie (OV/OmU)",
  },
  {
    id: "cinema",
    name: "Cinéma",
    address: "Roßmarkt 7, 60311 Frankfurt am Main",
    icsFile: "cinema.ics",
    calendarName: "Cinéma (OV/OmU)",
  },
  {
    id: "eldorado",
    name: "Eldorado",
    address: "Schäfergasse 29, 60313 Frankfurt am Main",
    icsFile: "eldorado.ics",
    calendarName: "Eldorado (OV/OmU)",
  },
  {
    id: "dff",
    name: "DFF Kino",
    address: "Schaumainkai 41, 60596 Frankfurt am Main",
    icsFile: "dff.ics",
    calendarName: "DFF Kino (OV/OmU)",
  },
  {
    id: "malsehn",
    name: "Mal Seh'n",
    address: "Adlerflychtstraße 6, 60318 Frankfurt am Main",
    icsFile: "malsehn.ics",
    calendarName: "Mal Seh'n (OV/OmU)",
  },
];

export function cinemaById(id: string): Cinema {
  const cinema = CINEMAS.find((c) => c.id === id);
  if (!cinema) throw new Error(`Unknown cinema id: ${id}`);
  return cinema;
}

export const COMBINED_ICS_FILE = "films.ics";
export const COMBINED_CALENDAR_NAME = "Kino Frankfurt (OV/OmU)";

export const ARTHOUSE_BASE_URL = "https://www.arthouse-kinos.de";
export const ARTHOUSE_PROGRAMME_URL = `${ARTHOUSE_BASE_URL}/programm-tickets/`;

export const DFF_PROGRAMME_URL =
  "https://www.dff.film/kino/kinoprogramm/aktuelles-kinoprogramm/";

export const MALSEHN_BASE_URL = "https://malsehnkino.de";
export const MALSEHN_WEEK_URL = `${MALSEHN_BASE_URL}/index.php?section=week`;
export const MALSEHN_KINDERKINO_URL = `${MALSEHN_BASE_URL}/index.php?section=Kinderkino`;
export const MALSEHN_TICKETS_URL = "https://kinotickets.express/frankfurt_malsehn";

export const PAGES_BASE_URL = "https://sophiamersmann.github.io/kino-cal";
