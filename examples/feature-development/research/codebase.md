# Codebase research — slugify

- No existing slug helper in `src/`. Nearest prior art: none. Safe to add `src/slugify.js`.
- Project is ESM (`"type": "module"`), zero runtime deps. Keep it dependency-free.
- Test runner is the Node built-in (`node --test`); put tests in `test/*.test.js`.
