export type Language = "OV" | "OmU" | "OmeU";

export interface Screening {
  /** Cinema id from the config registry, e.g. "harmonie" */
  cinema: string;
  title: string;
  start: Date;
  /** Stable kinoheld show id — used for deduping and as ICS UID */
  showId: string;
  bookingUrl: string;
  filmUrl?: string;
  /** null = German version (original or dub) */
  language: Language | null;
  lengthMinutes?: number;
  fsk?: string;
  country?: string;
  originalLanguage?: string;
}

/** Metadata scraped from a film detail page (/filme/<slug>/) */
export interface FilmDetails {
  country?: string;
  year?: number;
  originalLanguage?: string;
  lengthMinutes?: number;
  fsk?: string;
}
