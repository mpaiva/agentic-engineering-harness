# Test strategy

Unit-test `slugify()` directly with `node --test`. Cases: casing+spacing, punctuation,
collapsed/edge separators, accent transliteration, empty-ish input. These cases ARE the
acceptance criteria the independent verifier re-derives from the objective.
