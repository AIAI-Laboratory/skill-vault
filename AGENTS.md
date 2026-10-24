# Repository instructions

Follow [the contribution workflow](CONTRIBUTING.md) for development and pull requests.
For new tasks, start from the latest `main` on a separate branch named
`<type>/<short-description>`, such as `fix/gemini-line-breaks`.
Preserve unrelated changes in existing checkouts; use a separate worktree when
needed. Keep the pre-commit and pre-push hooks enabled. Before opening or updating
an implementation pull request, run `npm run verify`, self-review the complete diff
against the base branch, fix failures, and report the results. Follow the
contribution workflow for documentation-only checks. Rerun verification after
review fixes; do not rely on results from an older commit. Do not lower coverage
thresholds or weaken lint rules to make a check pass.

When creating commits or proposing commit messages, follow
[the commit message guidelines](docs/commit-message-guidelines.md).
Use Skill Vault scopes from that guide and include a meaningful body of at least
20 characters unless the type is `docs`. Consult the guide for reverts and
breaking changes.
