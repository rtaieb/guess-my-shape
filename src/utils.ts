// Calculate Levenshtein distance between two strings
export function levenshteinDistance(a: string, b: string): number {
  const matrix = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) == a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, // substitution
                                Math.min(matrix[i][j - 1] + 1, // insertion
                                         matrix[i - 1][j] + 1)); // deletion
      }
    }
  }

  return matrix[b.length][a.length];
}

// Normalize a string (remove accents, to lowercase, trim)
export function normalizeWord(word: string): string {
  return word
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

// Check if a guess is close enough to the target word
export function isGuessCorrect(guess: string, target: string): boolean {
  const normGuess = normalizeWord(guess);
  const normTarget = normalizeWord(target);
  
  if (normGuess === normTarget) return true;
  
  // Allow 1 typo for words <= 5 chars, 2 typos for longer words
  const maxTypos = normTarget.length <= 5 ? 1 : 2;
  const distance = levenshteinDistance(normGuess, normTarget);
  
  return distance <= maxTypos;
}

export function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}
