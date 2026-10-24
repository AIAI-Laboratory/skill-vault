# Commit message guidelines

Skill Vault follows the [Angular commit message guidelines](https://github.com/angular/angular/blob/main/contributing-docs/commit-message-guidelines.md), with scopes adapted to this extension.

For branch naming, development checks, and pull requests, follow the
[contribution workflow](../CONTRIBUTING.md).

## Format

```text
<type>(<scope>): <summary>

<body>

<footer>
```

- Require a type and summary; omit the scope for changes spanning several areas.
- Write commits in English. Use an imperative, present-tense summary, beginning with lowercase and without a final period.
- Require a body of at least 20 characters for every type except `docs`. Separate it from the header with a blank line. Explain the motivation and relevant behavior changes.
- Use an optional footer for issue references, breaking changes, or deprecations.

## Types

| Type       | Use for                                                |
| ---------- | ------------------------------------------------------ |
| `build`    | Build tooling and dependencies                         |
| `ci`       | CI workflows and automation                            |
| `docs`     | Documentation                                          |
| `feat`     | New functionality                                      |
| `fix`      | Bug fixes                                              |
| `perf`     | Performance improvements                               |
| `refactor` | Restructuring without fixing a bug or adding a feature |
| `test`     | Adding or correcting tests                             |

Use `revert` for reversions as described below. Classify maintenance work by its purpose using these types.

## Skill Vault scopes

Choose the area a contributor would look for in the history. These scopes are recommendations, not a closed list; use a focused lowercase, kebab-case name when a new area needs one.

| Scope        | Project area                                                            |
| ------------ | ----------------------------------------------------------------------- |
| `adapters`   | Shared composer integration in `src/adapters/`                          |
| `chatgpt`    | ChatGPT adapter behavior                                                |
| `claude`     | Claude adapter behavior                                                 |
| `gemini`     | Gemini chat adapter behavior                                            |
| `content`    | Content runtime, slash commands, palette, and selection                 |
| `sidepanel`  | Skill management screens and settings                                   |
| `ui`         | Shared components in `src/components/ui/` and global styling            |
| `domain`     | Skill rules, validation, variables, and domain types                    |
| `storage`    | Repositories, persistence, seed data, and backups                       |
| `messaging`  | Extension message contracts and clients                                 |
| `ai`         | Gemini prompt formatting integration; use `gemini` for the chat adapter |
| `background` | Service worker, context menus, routing, and cleanup                     |
| `providers`  | Custom provider permissions, registration, and integration              |
| `extension`  | Manifest, extension permissions, and packaged assets                    |
| `tooling`    | Developer scripts, linting, formatting, and Git setup                   |
| `deps`       | Dependency updates                                                      |
| `release`    | Release automation and packaging                                        |

Tests normally use the scope of the feature under test, such as `test(storage)`.
Use `docs:` for project-wide documentation. Omit the scope when no single area describes the change well.

## Examples

```text
feat(providers): support custom chat origins

Allow locally hosted chat apps to use the skill palette after the user
grants access to their origin.
```

```text
fix(gemini): preserve line breaks when inserting skills

Keep multiline prompts readable in the Gemini composer so lists retain
their intended structure after insertion.

Fixes #123
```

```text
build(deps): update vite

Keep the extension build toolchain compatible with the supported Node versions.
```

```text
docs: explain how to restore trashed skills
```

## Breaking changes and deprecations

Start the footer with `BREAKING CHANGE:` or `DEPRECATED:`, followed by a short summary. After a blank line, explain the impact and migration or replacement steps.

```text
feat(storage): version exported skill backups

Make the backup schema explicit so importers can handle future format updates.

BREAKING CHANGE: wrap exported skills in a versioned object

Update backup consumers to read the skills array from the new envelope.
Existing bare-array backups must be converted before importing.
```

## Reverts

Prefix the original header with `revert: `. In the body, include `This reverts commit <SHA>.` and explain why the reversal is needed.

```text
revert: feat(providers): support custom chat origins

This reverts commit <full-commit-sha>.

Restore the previous behavior while investigating provider permission handling.
```

## Use the Git template

Run once from the repository root after cloning:

```bash
npm run setup:commits
```

This sets this checkout's `commit.template` to the tracked `.gitmessage` file. Run `git commit` to open the template in your configured editor. Replace the commented placeholders with your message; Git removes the comment lines. `git commit -m` bypasses the template, so follow the same rules when supplying messages inline.

This setup provides writing guidance; commit messages are not automatically validated by a hook or CI. Apply the guide to squash commit messages as well. Git-generated merge messages and automated dependency updates can retain their generated format.
