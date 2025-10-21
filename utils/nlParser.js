// ...existing code...
function parseNaturalLanguage(query) {
  if (typeof query !== "string" || !query.trim()) {
    throw new Error("Query must be a non-empty string");
  }

  const q = query.toLowerCase();
  const parsed = {};

  // single word / one-word
  if (/\b(?:single[- ]?word|one[- ]?word)\b/.test(q)) {
    parsed.word_count = 1;
  }

  // palindrome / palindromic
  if (/\bpalindrom(?:e|ic)\b/.test(q)) {
    parsed.is_palindrome = true;
  }

  // longer than N  -> min_length = N + 1 (strictly longer)
  const longerMatch = q.match(/longer than (\d+)/i);
  if (longerMatch) {
    const n = parseInt(longerMatch[1], 10);
    if (!Number.isNaN(n)) parsed.min_length = n + 1;
  }

  // shorter than N -> max_length = N - 1 (strictly shorter)
  const shorterMatch = q.match(/shorter than (\d+)/i);
  if (shorterMatch) {
    const n = parseInt(shorterMatch[1], 10);
    if (!Number.isNaN(n)) parsed.max_length = n - 1;
  }

  // containing a specific letter/character (single letter)
  const containsMatch = q.match(/(?:containing the letter|containing|contains) ([a-z])/i);
  if (containsMatch) {
    parsed.contains_character = containsMatch[1].toLowerCase();
  }

  // "first vowel" heuristic -> map to 'a' (simple)
  if (/\bfirst vowel\b/.test(q)) {
    parsed.contains_character = parsed.contains_character || "a";
  }

  if (Object.keys(parsed).length === 0) {
    const err = new Error("Unable to parse natural language query");
    err.code = "UNPARSEABLE";
    throw err;
  }

  return parsed;
}

module.exports = { parseNaturalLanguage };
// ...existing code...
function parseNaturalLanguage(query) {
  if (!query || typeof query !== "string") {
    throw new Error("Query must be a non-empty string");
  }

  const q = query.toLowerCase();

  const parsed = {};

  // single word / single-word
  if (/\bsingle[- ]?word\b/.test(q) || /\bone[- ]word\b/.test(q)) {
    parsed.word_count = 1;
  }

  // palindrome / palindromic
  if (/\bpalindrom(e|ic|ic strings?)\b/.test(q) || /\bpalindromic\b/.test(q)) {
    parsed.is_palindrome = true;
  }

  // strings longer than N or longer than N characters
  const longerMatch = q.match(/longer than (\d+)/);
  if (longerMatch) {
    const n = parseInt(longerMatch[1], 10);
    if (!Number.isNaN(n)) parsed.min_length = n + 1;
  }

  // strings shorter than N
  const shorterMatch = q.match(/shorter than (\d+)/);
  if (shorterMatch) {
    const n = parseInt(shorterMatch[1], 10);
    if (!Number.isNaN(n)) parsed.max_length = n - 1;
  }

  // strings containing the letter X
  const containsMatch = q.match(/containing the letter (\w)|containing (\w)|contains (\w)/);
  if (containsMatch) {
    // find last non-empty capture
    for (let i = 1; i < containsMatch.length; i++) {
      if (containsMatch[i]) {
        parsed.contains_character = containsMatch[i];
        break;
      }
    }
  }

  // "that contain the first vowel" heuristic -> map to 'a' (simple)
  if (/\bfirst vowel\b/.test(q)) {
    parsed.contains_character = "a"; // heuristic decision
  }

  if (Object.keys(parsed).length === 0) {
    // Could not parse; the spec requires 400 when unable
    const err = new Error("Unable to parse natural language query");
    err.code = "UNPARSEABLE";
    throw err;
  }

  return parsed;
}

module.exports = { parseNaturalLanguage };
