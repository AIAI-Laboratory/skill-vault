# Repository instructions

Follow [the contribution workflow](CONTRIBUTING.md) for development and pull requests.
For new tasks, start from the latest `main` on a separate branch named
`codex/<type>-<short-description>`, such as `codex/fix-gemini-line-breaks`.
Preserve unrelated changes in existing checkouts; use a separate worktree when
needed. Run the checks appropriate to the change and report their results.

When creating commits or proposing commit messages, follow
[the commit message guidelines](docs/commit-message-guidelines.md).
Use Skill Vault scopes from that guide and include a meaningful body of at least
20 characters unless the type is `docs`. Consult the guide for reverts and
breaking changes.
