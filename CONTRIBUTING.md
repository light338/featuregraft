# Contributing

FeatureGraft needs independent feature transplant cases and upstream-update
cases. Useful reports describe the source feature, receiving data model and
interfaces, checks written before adaptation, actual outcome and required fixes.
Do not include private code, credentials or confidential data.

```sh
npm install
npm run check
npm test
```

The offline tests do not invoke a model or make network requests. The live demo
is separately opt-in and uses existing Codex access. Do not relabel synthetic
fixtures or our own model runs as external users.

PRs should identify a real failure and add a regression case when behavior
changes. Preserve existing checks, attribution and license provenance. Respect
the source project's license when submitting reproductions or new feature examples.
