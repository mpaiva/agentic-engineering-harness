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
  if (typeof maxLen !== "number" || maxLen < 0) return str;
  if (str.length <= maxLen) return str;
  // Independent-review fix (goal run 7076c025): when maxLen < suffix.length the old
  // `maxLen - suffix.length` slice endpoint went negative and returned a string LONGER
  // than maxLen. Fall back to a clipped suffix so the result never exceeds maxLen.
  if (maxLen <= suffix.length) return suffix.slice(0, maxLen);
  return str.slice(0, maxLen - suffix.length) + suffix;
}
