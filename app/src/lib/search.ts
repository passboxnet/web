/**
 * Search with typo tolerance: "salesfroce" finds "Salesforce", "bank" finds
 * "Sparkasse Online-Banking". Every word of the query must match a word of
 * the text, as a substring, as a prefix with a few typos, or loosely as a
 * whole word.
 */

/** Lowercase, without accents (ä → a) so "Muller" finds "Müller". */
export function normalize(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

function words(text: string): string[] {
  return normalize(text)
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

/** Optimal string alignment distance (Levenshtein plus swapped neighbors), capped at `max + 1`. */
export function editDistance(a: string, b: string, max = 2): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let previous2: number[] = [];
  let previous = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let value = Math.min((previous[j] ?? 0) + 1, (row[j - 1] ?? 0) + 1, (previous[j - 1] ?? 0) + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        value = Math.min(value, (previous2[j - 2] ?? 0) + 1);
      }
      row.push(value);
      best = Math.min(best, value);
    }
    if (best > max) return max + 1;
    previous2 = previous;
    previous = row;
  }
  return previous[b.length] ?? max + 1;
}

/** Typos allowed for a query word of this length. */
function allowedTypos(length: number): number {
  if (length < 4) return 0;
  if (length < 8) return 1;
  return 2;
}

/**
 * How well `query` matches `text`: 0 for no match, higher is better. Exact
 * substrings score 3, prefixes of words with typos 2, loose whole-word
 * matches 1 (per query word, averaged).
 */
export function matchScore(query: string, text: string): number {
  const terms = words(query);
  if (terms.length === 0) return 1;
  const haystack = normalize(text);
  const candidates = words(text);
  let total = 0;
  for (const term of terms) {
    if (haystack.includes(term)) {
      total += 3;
      continue;
    }
    const typos = allowedTypos(term.length);
    if (typos === 0) return 0;
    let best = 0;
    for (const word of candidates) {
      if (editDistance(term, word.slice(0, term.length), typos) <= typos) {
        best = 2;
        break;
      }
      if (editDistance(term, word, typos) <= typos) best = 1;
    }
    if (best === 0) return 0;
    total += best;
  }
  return total / terms.length;
}

/** True when every query word appears exactly (no typo tolerance needed). */
export function isExactMatch(query: string, text: string): boolean {
  return matchScore(query, text) === 3 || words(query).length === 0;
}
