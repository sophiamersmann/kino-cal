import ical from "ical-generator";
import { cinemaById } from "./config.js";
import type { Screening } from "./types.js";

const DEFAULT_LENGTH_MINUTES = 120;
const BUFFER_MINUTES = 15;

export interface IcsOptions {
  calendarName: string;
  /** Append "@ <Cinema>" to event titles (for the combined calendar) */
  cinemaInTitle?: boolean;
}

export function toIcs(screenings: Screening[], options: IcsOptions): string {
  const calendar = ical({
    name: options.calendarName,
    prodId: { company: "sophiamersmann", product: "kino-cal", language: "DE" },
  });
  // Hint clients to re-fetch twice a day
  calendar.x("X-PUBLISHED-TTL", "PT12H");

  for (const s of [...screenings].sort((a, b) => a.start.getTime() - b.start.getTime())) {
    const cinema = cinemaById(s.cinema);
    const minutes = (s.lengthMinutes ?? DEFAULT_LENGTH_MINUTES) + BUFFER_MINUTES;

    let summary = s.title;
    if (s.language) summary += ` (${s.language})`;
    if (options.cinemaInTitle) summary += ` @ ${cinema.name}`;

    const description = [
      s.bookingUrl && `Tickets: ${s.bookingUrl}`,
      s.filmUrl && `Film: ${s.filmUrl}`,
      s.lengthMinutes && `Dauer: ${s.lengthMinutes} Min.`,
      s.fsk && `FSK: ${s.fsk}`,
    ]
      .filter(Boolean)
      .join("\n");

    calendar.createEvent({
      id: `${s.showId}@kino-cal`,
      start: s.start,
      end: new Date(s.start.getTime() + minutes * 60_000),
      summary,
      description,
      location: `${cinema.name}, ${cinema.address}`,
      url: s.bookingUrl || undefined,
    });
  }

  // RFC 7986 REFRESH-INTERVAL lacks the X- prefix ical-generator requires,
  // so splice it in next to the TTL hint.
  return calendar
    .toString()
    .replace(
      "X-PUBLISHED-TTL:PT12H",
      "X-PUBLISHED-TTL:PT12H\r\nREFRESH-INTERVAL;VALUE=DURATION:PT12H",
    );
}
