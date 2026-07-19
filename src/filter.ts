import type { Screening } from "./types.js";

export type Predicate = (s: Screening) => boolean;

const GERMAN_SPEAKING_COUNTRY = /\b(Deutschland|BRD|DDR|Österreich|Schweiz)\b/i;

/** Original version or subtitled (OV/OmU/OmeU). */
export const isTaggedOriginal: Predicate = (s) => s.language !== null;

/**
 * Untagged screening that is a German-language original (not a dub).
 * Primary signal: Originalsprache from the film detail page; fallback:
 * production country. With no metadata at all we exclude — an untagged
 * screening is more likely a dubbed foreign film.
 */
export const isGermanOriginal: Predicate = (s) => {
  if (s.language !== null) return false;
  // An explicit dub marker (DF / "Deutsche Fassung") beats the country
  // heuristic — e.g. a German co-production shown as a dubbed print.
  if (s.dubbed) return false;
  if (s.originalLanguage) return /deutsch/i.test(s.originalLanguage);
  if (s.country) return GERMAN_SPEAKING_COUNTRY.test(s.country);
  return false;
};

export function anyOf(...predicates: Predicate[]): Predicate {
  return (s) => predicates.some((p) => p(s));
}

/** The selection rule: originals with(out) subs, plus German-language originals. */
export const defaultFilter: Predicate = anyOf(isTaggedOriginal, isGermanOriginal);

export const includeAll: Predicate = () => true;

/**
 * Per-cinema overrides. Mal Seh'n shows everything in OV/OmU but rarely
 * annotates the language, so the default untagged-foreign-film exclusion
 * would wrongly drop subtitled originals there. Orfeos Erben (via
 * Eventfrog) has no language metadata at all.
 */
const CINEMA_FILTERS: Record<string, Predicate> = {
  malsehn: includeAll,
  orfeos: includeAll,
};

export const selectionFilter: Predicate = (s) =>
  (CINEMA_FILTERS[s.cinema] ?? defaultFilter)(s);

export function filterScreenings(
  screenings: Screening[],
  predicate: Predicate = selectionFilter,
): Screening[] {
  return screenings.filter(predicate);
}
