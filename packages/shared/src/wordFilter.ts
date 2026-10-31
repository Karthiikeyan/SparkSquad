/**
 * Word filter for names, notes, comments and announcements (Architecture §10).
 * Matches whole words after normalising case, accents and common look-alike characters.
 * The list is intentionally short and extendable; the server can pass extra words.
 */
const BASE_WORDS = [
  // English slurs and severe profanity
  'fuck',
  'fucker',
  'fucking',
  'motherfucker',
  'shit',
  'bitch',
  'cunt',
  'whore',
  'slut',
  'bastard',
  'dick',
  'pussy',
  'asshole',
  'nigger',
  'nigga',
  'faggot',
  'fag',
  'retard',
  'tranny',
  'chink',
  'paki',
  'spic',
  'kike',
  'rape',
  'rapist',
  // Common Hindi/Tamil transliterated abuse
  'chutiya',
  'chutiye',
  'madarchod',
  'behenchod',
  'bhenchod',
  'bhosdike',
  'bhosdi',
  'randi',
  'gandu',
  'harami',
  'lavda',
  'lauda',
  'lund',
  'thevidiya',
  'punda',
  'otha',
  'koothi',
];

const LEET: Record<string, string> = {
  '0': 'o',
  '1': 'i',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '7': 't',
  '@': 'a',
  $: 's',
  '!': 'i',
};

export function normalizeForFilter(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[013457@$!]/g, (c) => LEET[c] ?? c)
    .replace(/(.)\1{2,}/g, '$1$1');
}

export interface WordFilter {
  /** Returns the first blocked word found, or null. */
  find(text: string): string | null;
  isAllowed(text: string): boolean;
}

export function createWordFilter(extraWords: readonly string[] = []): WordFilter {
  const words = new Set([...BASE_WORDS, ...extraWords.map((w) => normalizeForFilter(w.trim()))]);
  words.delete('');
  const find = (text: string): string | null => {
    const normalized = normalizeForFilter(text);
    const tokens = normalized.split(/[^a-z]+/).filter(Boolean);
    for (const t of tokens) if (words.has(t)) return t;
    // Catch spaced-out spellings like "f u c k" by joining runs of single letters.
    let run = '';
    for (const t of [...tokens, '']) {
      if (t.length === 1) {
        run += t;
        continue;
      }
      if (run.length > 1 && words.has(run)) return run;
      run = '';
    }
    return null;
  };
  return { find, isAllowed: (text) => find(text) === null };
}

export const wordFilter = createWordFilter();
