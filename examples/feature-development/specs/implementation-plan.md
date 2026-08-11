# Implementation plan — slugify()

## Change set
- Add `src/slugify.js` exporting `slugify(input: string): string`.
- Add `test/slugify.test.js` covering the acceptance cases.

## Approach
1. Guard non-strings → "".
2. Lowercase, then transliterate a common accent set to ASCII.
3. Replace runs of non-alphanumerics with a single hyphen.
4. Trim leading/trailing hyphens.

## Verification criteria (evidence required)
- `node --check src/slugify.js` passes (typecheck).
- `node --test` → all cases pass.

## Risks / open questions
- Accent coverage is a curated subset, not full Unicode normalization. Acceptable for the
  objective; note as a follow-up if non-Latin scripts are needed.
