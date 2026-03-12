// Minimal bundled profanity filter for Poki compliance.
// No external API calls — small word list checked against player names.

const BLOCKED: readonly string[] = [
  'ass', 'asshole', 'bastard', 'bitch', 'bollocks', 'bullshit',
  'cock', 'crap', 'cuck', 'cum', 'cunt', 'damn', 'dick',
  'dildo', 'fag', 'faggot', 'fuck', 'fucker', 'fucking',
  'hell', 'ho', 'hoe', 'jackass', 'jerk', 'jizz', 'kike',
  'motherfucker', 'nigga', 'nigger', 'piss', 'prick', 'pussy',
  'retard', 'shit', 'slut', 'spic', 'twat', 'whore', 'wank',
];

/**
 * Returns true if the name contains a blocked word.
 * Case-insensitive, matches whole words (not substrings like "scunthorpe").
 */
export function containsProfanity(name: string): boolean {
  const normalized = name.toLowerCase().replace(/[^a-z0-9]/g, ' ');
  const words = normalized.split(/\s+/).filter(Boolean);
  return words.some(word => BLOCKED.includes(word));
}
