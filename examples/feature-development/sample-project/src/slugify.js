// slugify — turn arbitrary text into a URL-safe slug.
// Implemented during the feature-development example's implementation phase.
const ACCENTS = {
  a: "àáâãäåā", c: "çćč", e: "èéêëē", i: "ìíîïī",
  n: "ñń", o: "òóôõöøō", u: "ùúûüū", y: "ýÿ", s: "śš", z: "žź",
};

const STRIP_MAP = (() => {
  const map = new Map();
  for (const [base, chars] of Object.entries(ACCENTS)) {
    for (const ch of chars) map.set(ch, base);
  }
  return map;
})();

/**
 * @param {string} input
 * @returns {string} lowercase, hyphen-separated, punctuation-stripped slug
 */
export function slugify(input) {
  if (typeof input !== "string") return "";
  const transliterated = Array.from(input.toLowerCase())
    .map((ch) => STRIP_MAP.get(ch) ?? ch)
    .join("");
  return transliterated
    .replace(/[^a-z0-9]+/g, "-") // non-alphanumerics become separators
    .replace(/-+/g, "-") // collapse repeats
    .replace(/^-|-$/g, ""); // trim edge separators
}
