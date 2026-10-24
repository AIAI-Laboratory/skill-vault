# Contributing to Skill Vault

Use a separate branch and a pull request for every change, including documentation,
dependency updates, and urgent fixes. Keep each contribution focused on one outcome.
Write branch names, commit messages, and pull requests in English.

## 1. Set up the project

Use Node.js 22 and npm. CI checks the project on Node.js 20 and 22.

```bash
git clone https://github.com/AIAI-Laboratory/skill-vault.git
cd skill-vault
npm ci
npm run setup:commits
```

If you do not have push access, fork the repository and clone your fork instead.
Add the original repository as `upstream`:

```bash
git remote add upstream https://github.com/AIAI-Laboratory/skill-vault.git
```

Husky installs the existing pre-commit hook during dependency installation. The hook
runs lint-staged to lint and format staged files. The commit template helps you write
messages; it does not validate them automatically.

## 2. Define the change

For a bug, identify the current behavior, expected behavior, and reproduction steps.
For a feature, describe the user need and expected result. Discuss substantial changes
in an issue before implementation so contributors can agree on the scope.

Small, clear fixes and documentation improvements can go straight to a pull request.
Keep unrelated cleanup in a separate branch and pull request.

## 3. Create a branch

Start new work from the latest `main`. Do not develop directly on `main` or push
changes directly to it.

Check `git status` first. If the checkout contains work from another task, preserve it
and use a separate checkout or worktree for the new task. Do not reset, discard, or
stash someone else's changes.

From a clean checkout:

```bash
git switch main
git pull --ff-only origin main
git switch -c feat/skill-folders
```

For a fork, fetch and update from the original repository instead:

```bash
git fetch upstream
git switch main
git merge --ff-only upstream/main
git switch -c feat/skill-folders
```

### Branch naming

Use `<type>/<short-description>`:

- Use lowercase English words separated by hyphens.
- Choose a type from the commit message guide that describes the main purpose.
- Describe the outcome clearly; avoid names such as `updates`, `my-branch`, or `fix-stuff`.
- Optionally put an issue number before the description: `fix/123-gemini-line-breaks`.
- Keep one branch per task. Create a new branch for follow-up work after a merge.

| Purpose               | Example                              |
| --------------------- | ------------------------------------ |
| Feature               | `feat/skill-folders`                 |
| Bug fix or urgent fix | `fix/gemini-line-breaks`             |
| Documentation         | `docs/contribution-workflow`         |
| Refactoring           | `refactor/adapter-selection`         |
| Performance           | `perf/palette-search`                |
| Tests                 | `test/storage-backup-import`         |
| Build or dependencies | `build/update-vite`                  |
| CI                    | `ci/check-extension-package`         |
| Revert                | `revert/custom-provider-permissions` |

Codex-created branches use `codex/<type>-<short-description>`, for example
`codex/feat-skill-folders` or `codex/docs-contribution-workflow`.
Automated dependency branches may keep their generated names.

## 4. Develop and verify

Follow the existing architecture and conventions described in the
[README](README.md). Add or update tests when behavior
changes, and document user-visible features or changes to setup.

Run the checks relevant to your work while developing. Before requesting review for
code, build, dependency, or workflow changes, run the same checks as CI:

```bash
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
```

For changes limited to documentation, check formatting and whitespace:

```bash
npx prettier --check CONTRIBUTING.md
git diff --check
```

Include every Markdown file you changed in the formatting command. CI still runs
its complete check suite for pull requests.

For extension behavior or UI changes, also load `dist/` as an unpacked extension
at `chrome://extensions`. Reload the extension and affected chat tabs after each
build. Verify the affected providers and flows manually, and include screenshots
or a recording for visible UI changes.

Use `npm run package` when changing packaging or release behavior and inspect the
generated ZIP. Keep build outputs, ZIP archives, credentials, and local environment
files out of commits.

## 5. Commit and push

Follow the [commit message guidelines](docs/commit-message-guidelines.md).
Stage only files belonging to the contribution, then inspect the staged diff:

```bash
git add src/adapters/gemini.ts tests/adapters/gemini.test.ts
git diff --cached
git commit
git push -u origin fix/gemini-line-breaks
```

The example assumes you are working on `fix/gemini-line-breaks`; substitute your
actual files and branch. Keep commits focused and explain why the change is needed
in the message body. Inspect and include any edits made by the pre-commit hook.

## 6. Open a pull request

Open the pull request against `AIAI-Laboratory/skill-vault:main`. Use a draft while
the work is incomplete. The repository's pull request template prompts you to include:

- The problem and resulting behavior.
- A related issue, using `Fixes #123` only if merging resolves it.
- The checks you ran and any remaining limitations.
- Manual verification steps and screenshots for visible changes.
- Migration steps for breaking changes.

Use the commit header format for the pull request title, such as
`fix(gemini): preserve line breaks when inserting skills`.

Request review when the change is ready and CI passes. Address feedback on the same
branch. If `main` changes and conflicts appear, merge the latest `origin/main`
(or `upstream/main` for forks) into your branch, resolve the conflicts, and rerun
affected checks. Avoid rewriting a shared branch's history.

## 7. Merge and clean up

A maintainer merges after review and passing CI. Prefer squash merging so each pull
request becomes one focused commit on `main`. Check the final squash title and body
against the commit message guide; a non-`docs` squash commit still needs a meaningful
body of at least 20 characters.

After the pull request is merged, delete its remote branch and update your local
`main`. Delete the local task branch once you have confirmed its work is present
on `main`. Squash merges can make Git report the original branch as unmerged;
verify the merged pull request before deleting it.

Releases are handled separately by maintainers. Version tags matching `v*` trigger
the release workflow; do not create or push release tags as part of an ordinary
contribution.

These rules are followed through contributor and maintainer review. Branch naming,
review requirements, and the merge method are not automatically enforced by this
documentation setup.
