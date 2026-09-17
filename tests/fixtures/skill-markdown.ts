// Representative of a SKILL.md selection from GitHub's Code view.
export const skillMarkdown = `---
name: codebase-replication
description: Learn conventions from a source repository and apply them to a target repository.
---

# Codebase Replication

Learn evidenced conventions from a source repo, then apply them to a target repo.
Learn from the source and record where each convention came from.

## Inputs

- **Source**: local path or GitHub URL.
- **Target**: repo to improve.

## Detect scope

Review manifests and source files; record versions and dependencies;
keep references such as \`<source>\` and \`&lt;example&gt;\` unchanged.

## Examples

\`\`\`sql
SELECT id FROM users WHERE active = 1;
\`\`\`

\`\`\`text
TypeError: Cannot read properties of undefined
    at run (app.js:10:15)
\`\`\`
`;
