export type Language = "OV" | "OmU" | "OmeU";

export interface Screening {
  /** Cinema id from the config registry, e.g. "harmonie" */
  cinema: string;
  title: string;
  start: Date;
  /** Stable ticketing-system show id (unique across cinemas) — used for deduping and as ICS UID */
  showId: string;
  bookingUrl: string;
  filmUrl?: string;
  /** Language tag, e.g. "OV", "OmU", "OmeU", "OmseU"; null = German version (original or dub) */
  language: string | null;
  /** Explicitly marked as a dubbed German version (DF / "Deutsche Fassung") */
  dubbed?: boolean;
  /** Film series ("Filmreihe") the screening belongs to, e.g. "Wim Wenders" */
  series?: string;
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
