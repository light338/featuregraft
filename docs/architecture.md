# Architecture and evidence boundaries

The core has four layers: static source extraction; immutable source capsules;
isolated candidate management; and registered behavioral verification. An MCP
client supplies the actual semantic adaptation. The CLI exposes the same operations.

Source extraction reads committed Git blobs. It rejects dirty sources, tracked
symlinks, path escapes, computed imports, unrecognized root licenses, unresolved
local imports and unsupported assets. TypeScript 6.0.3 is pinned for its JavaScript
Compiler API; TypeScript 7's package did not expose that parser API in this environment.
The extractor follows imports/reexports and CSS references, not arbitrary runtime
service/data dependencies. There is no whole-application extraction claim.

Capsules contain selected file bytes, their SHA-256 digests, import edges, source
commit, npm dependency declarations and original license. Their manifest and
files are checked before finishing/verifying a plan. They live under the target
Git directory rather than in its source tree.

Each graft gets a detached Git worktree outside source and target. Existing tests
and explicitly declared external contract files are hashed before adaptation.
Snapshotting uses a temporary Git index, adapted from Unmix. `finish` writes
provenance and source-license files and retains the full candidate snapshot in
`refs/featuregraft/plans/PLAN_ID`. It does not change the candidate or original
HEAD. `inspect` compares the complete current tree, including newly added files,
against the candidate base.

Verification requires a finished current tree and registered checks. It compares
original source/target HEAD, tree, index entries and status before and after
execution, validates frozen test/contract/capsule hashes and refuses to pass if
checks mutate tracked/nonignored candidate files. Ignored build output is allowed.
Checks are trusted code and run with ordinary process permissions, without shell
interpolation; candidate separation is not process isolation.

An upstream comparison extracts the new committed source closure and compares
it with the old capsule. Update preparation requires a previously verified
adaptation. If the target still has its original HEAD, the prior candidate
snapshot becomes the new base. An accepted target is identified by its persisted
receipt and can supply its current clean HEAD. The old candidate and source
capsule are retained. The agent adapts the source diff, not a prepared target patch.

The ledger is local. Moving a provenance receipt to another machine does not
yet reconstruct the local source capsules, plan history or update relationship.
Operations are sequential, with a lock. Interrupted operations may need manual
inspection of the lock, worktrees and capsule directory; full crash recovery is
not implemented. Windows/LFS/submodules/sparse checkout are unvalidated.

Frozen files are an integrity check against accidental or agent-made test edits,
not an OS-level security boundary against a hostile process. Only declared
contracts and identified existing tracked test files are frozen. Passing checks
does not establish complete behavior, license compatibility or general semantic
equivalence.
