
const crypto = require("crypto");

/**
 * Compute sha256 hex digest for a string
 */
function sha256Hex(value) {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

/**
 * Build character frequency map (case-sensitive, counts every char)
 * Returns object mapping characters to their counts
 */
function charFrequencyMap(value) {
  const map = {};
  for (const ch of value) {
    map[ch] = (map[ch] || 0) + 1;
  }
  return map;
}

/**
 * Check palindrome: case-insensitive and ignore whitespace characters.
 * (Non-alphanumeric characters are NOT removed by default — only whitespace is ignored.)
 */
function isPalindrome(value) {
  const normalized = value.replace(/\s+/g, "").toLowerCase();
  const rev = normalized.split("").reverse().join("");
  return normalized === rev;
}

/**
 * Count words separated by whitespace, trimming first; empty string => 0
 */
function wordCount(value) {
  if (!value || !value.trim()) return 0;
  return value.trim().split(/\s+/).length;
}

/**
 * Analyze string and return properties object
 */
function analyze(value) {
  if (typeof value !== "string") {
    throw new TypeError("value must be a string");
  }

  const hash = sha256Hex(value);
  const freq = charFrequencyMap(value);
  const unique = Object.keys(freq).length;
  const words = wordCount(value);
  const pal = isPalindrome(value);

  return {
    length: value.length,
    is_palindrome: pal,
    unique_characters: unique,
    word_count: words,
    sha256_hash: hash,
    character_frequency_map: freq
  };
}

module.exports = {
  analyze,
  sha256Hex
};
