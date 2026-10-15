# FeatureGraft v0.1.0

Bring a working JavaScript/TypeScript feature from a Git project into an existing
application, with an agent adapting it to your data model and design. Then carry
an upstream fix into that adaptation.

This experimental release includes a local CLI, eight-tool stdio MCP server,
source dependency closure extraction, pinned source capsules, isolated worktrees,
source license/provenance, frozen registered contracts and update comparisons.

A real Codex CLI ported a React table between two independently styled fixture
applications, then applied an upstream accent-search fix. The receiving app's
records, portfolio calculation and design were retained. The independent DOM
oracle checked search, filtering, sorting, Unicode and filtered CSV escaping;
typechecks and production builds passed. Real browser inspection separately
confirmed accent search, filtering, sort toggling and a real CSV download.

There are no prewritten target adapters. The source feature and upstream fix are
authored fixture inputs. This does not demonstrate general cross-framework
translation or external adoption. Native headless Chrome launch was blocked by
the desktop executor, so automated interaction verification here used jsdom.
The standalone browser oracle is included for other environments.

Install from the source checkout with `npm install` or `pnpm install`, then run
`node bin/featuregraft.mjs help`. Use README.md for Codex registration, the live
demo, update flow and current boundaries. No npm registry publication is claimed.

Please try one feature transplant in a small project and report what worked,
what broke and whether an upstream update preserved your adaptations. Use the
Feature transplant trial issue form. Real reports will decide the next release.
