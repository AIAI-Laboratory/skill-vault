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

Husky installs the Git hooks during dependency installation:

- `pre-commit` runs lint-staged to fix and format staged files, rejects all ESLint
  warnings and errors, then type-checks the whole working tree.
- `pre-push` runs `npm run verify`: formatting, zero-warning lint, type checking,
  tests with coverage thresholds, and the production build. A failing check stops
  the push before a pull request is opened or updated.

Keep hooks enabled and fix failures before retrying. Local hooks can be skipped
or missing in another checkout, so GitHub's required checks enforce the same
quality requirements independently. The commit template helps you write messages;
it does not validate them automatically.

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

Automated dependency branches may keep their generated names.

## 4. Develop and verify

Follow the existing architecture and conventions described in the
[README](README.md). Add or update tests when behavior
changes, and document user-visible features or changes to setup.

Run the checks relevant to your work while developing. Before opening or updating
an implementation pull request, run the complete local equivalent of CI:

```bash
npm run verify
```

This command stops on the first failure and runs formatting, zero-warning lint,
type checking, tests with coverage thresholds, and the production build. Resolve
all failures before pushing. After changing code in response to review, rerun it
on the final changes; an earlier successful run does not validate a later commit.

CI requires formatting, ESLint with zero warnings, type checking, tests on Node.js
20 and 22, coverage thresholds on Node.js 22, and a successful build. The
`Quality Gate` fails if a required job fails, is cancelled, or is skipped.
Coverage includes every TypeScript source file under `src/`, including untested
files. Initial global minimums follow the measured baseline: 45% statements and
lines, 70% branches, and 60% functions. Increase these minimums in `vite.config.ts`
as tests improve; do not lower them to make a failing pull request pass.

Open the Node.js 22 check summary for the coverage table and download the
`coverage-report` artifact for HTML and LCOV reports. The `PR Coverage Report`
workflow keeps one coverage comment on each pull request, including fork pull
requests, after CI completes. Reports are still published when tests or coverage
thresholds fail, if Vitest produced a report. If CI fails before producing
coverage, the comment links to the failed run instead of showing old percentages.
The reporting workflow must first be merged into the default branch to activate.

For changes limited to documentation, check formatting and whitespace:

```bash
npx prettier --check CONTRIBUTING.md
git diff --check
```

Include every Markdown file you changed in the formatting command. Hooks and CI
still run their complete check suite, including for documentation pull requests.

For extension behavior or UI changes, also load `dist/` as an unpacked extension
at `chrome://extensions`. Reload the extension and affected chat tabs after each
build. Verify the affected providers and flows manually, and include screenshots
or a recording for visible UI changes.

Use `npm run package` when changing packaging or release behavior and inspect the
generated ZIP. Keep build outputs, ZIP archives, credentials, and local environment
files out of commits.

## 5. Commit and push

Follow the [commit message guidelines](docs/commit-message-guidelines.md).
Before committing:

1. Add or update regression tests for behavior changes and verify the affected flow.
2. Stage only files belonging to this contribution.
3. Read `git diff --cached` and check for accidental edits, debug code, credentials,
   generated outputs, unsafe type assertions, or lint suppressions added merely
   to silence a failure. Fix the cause instead of weakening a check.
4. Commit. The pre-commit hook must finish successfully. It checks staged JavaScript
   and TypeScript with `eslint --fix --max-warnings=0`, formats staged files, and
   then runs the project typecheck. Lint warnings block the commit even when ESLint
   can otherwise exit successfully. Inspect the hook's staged fixes after committing.
5. Push. The pre-push hook must complete `npm run verify` successfully. If it fails,
   fix the problem, commit the fix, and push again.

For example:

```bash
git add src/adapters/gemini.ts tests/adapters/gemini.test.ts
git diff --cached
git commit
git push -u origin fix/gemini-line-breaks
```

The example assumes you are working on `fix/gemini-line-breaks`; substitute your
actual files and branch. Keep commits focused and explain why the change is needed
in the message body. Hooks can modify staged files; inspect `git show --stat` and
`git show` after the commit to confirm the final contents. Check `git status` before
pushing so local verification covers the changes you intend to send.

## 6. Open a pull request

Before creating a pull request, self-review the complete change against the base:

```bash
git fetch origin main
git diff --check origin/main...HEAD
git diff origin/main...HEAD
```

For forks, substitute `upstream/main`. Confirm the implementation meets the stated
behavior, has meaningful tests, and introduces no unrelated changes. Record the
successful `npm run verify` result in the PR description. Automated checks catch
formatting, lint, type, tested behavior, coverage, and build failures; they cannot
replace human review of logic, security, architecture, or usability.

Open the pull request against `AIAI-Laboratory/skill-vault:main`. Use a draft while
the work is incomplete and list any outstanding work. The repository's pull
request template prompts you to include:

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

A maintainer merges after review, resolving review conversations, and passing CI.
The default branch requires all four checks: `Code Quality`,
`Build & Test (Node 20.x)`, `Build & Test (Node 22.x)`, and `Quality Gate`.
The branch must be up to date before merging. Prefer squash merging so each pull
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

The active GitHub `pr-quality-gates` ruleset enforces pull requests, resolved review
conversations, an up-to-date branch, and these required checks, with no bypass
actors. Its configuration is tracked in
[`.github/rulesets/pr-quality-gates.json`](.github/rulesets/pr-quality-gates.json).
Tracking this JSON alone does not apply settings: repository admins must create
or update the corresponding GitHub ruleset through Settings → Rules → Rulesets
or the GitHub API. Keep other rulesets, such as `protect-main`, in place; their
review requirements still apply. Branch names and the preferred squash merge
method remain contributor conventions.
