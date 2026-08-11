// truncate — shorten text to a maximum length, marking the cut with a suffix.
// Implemented during the feature-development example's implementation phase.

/**
 * @param {string} str
 * @param {number} maxLen total length budget, suffix included
 * @param {string} [suffix="..."] marker appended when the string is shortened
 * @returns {string} str unchanged when it fits, otherwise a string of length
 *   maxLen ending with suffix; "" when str is not a string
 */
export function truncate(str, maxLen, suffix = "...") {
  if (typeof str !== "string") return "";
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - suffix.length) + suffix;
}
