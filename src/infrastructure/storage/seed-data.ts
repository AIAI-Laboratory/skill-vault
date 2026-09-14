import { Skill } from '../../domain/types';

export const SEED_SKILLS: Skill[] = [
  {
    id: 'sk_seed_01_review',
    schemaVersion: 1,
    name: 'Code Review',
    description: 'Comprehensive senior engineer review for correctness, security, and performance',
    shortcut: 'review',
    content: `You are a Principal Software Engineer. Conduct a rigorous, constructive code review of the following snippet.

Analyze for:
1. Correctness and edge cases (race conditions, null/undefined, error paths)
2. Security vulnerabilities and sanitize checks
3. Performance, computational complexity, and memory leaks
4. Code readability, maintainability, and idioms

Provide concrete code diffs or examples for suggested improvements.

Code to review:
{{selected_text}}`,
    tags: ['coding', 'review', 'engineering'],
    favorite: true,
    variables: [],
    createdAt: '2026-09-14T00:00:00.000Z',
    updatedAt: '2026-09-14T00:00:00.000Z',
    usage: { count: 3, lastUsedAt: '2026-09-14T10:00:00.000Z' },
  },
  {
    id: 'sk_seed_02_explain',
    schemaVersion: 1,
    name: 'Explain Simply',
    description: 'Explain complex technical concepts with ELI5 clarity and intuitive metaphors',
    shortcut: 'explain',
    content: `Explain the following topic or code in simple, intuitive terms as if explaining to a curious high school student.

Use:
- A memorable real-world analogy
- Why it matters
- The core mechanism broken into 2-3 simple steps
- Common pitfalls to avoid

Topic:
{{selected_text}}`,
    tags: ['learning', 'concept', 'writing'],
    favorite: true,
    variables: [],
    createdAt: '2026-09-14T00:00:00.000Z',
    updatedAt: '2026-09-14T00:00:00.000Z',
    usage: { count: 2, lastUsedAt: '2026-09-14T09:30:00.000Z' },
  },
  {
    id: 'sk_seed_03_rewrite',
    schemaVersion: 1,
    name: 'Professional Rewrite',
    description: 'Refine draft writing into clear, authoritative, and concise prose',
    shortcut: 'rewrite',
    content: `Rewrite the following draft text to be polished, professional, concise, and impactful.

Guidelines:
- Eliminate filler words and passive voice
- Maintain an authoritative yet collaborative tone
- Enhance clarity and paragraph transitions

Draft:
{{selected_text}}`,
    tags: ['writing', 'productivity', 'email'],
    favorite: false,
    variables: [],
    createdAt: '2026-09-14T00:00:00.000Z',
    updatedAt: '2026-09-14T00:00:00.000Z',
    usage: { count: 1, lastUsedAt: '2026-09-14T08:00:00.000Z' },
  },
  {
    id: 'sk_seed_04_debug',
    schemaVersion: 1,
    name: 'Bug Investigator',
    description: 'Systematic root cause analysis, hypothesis generation, and reproduction plan',
    shortcut: 'debug',
    content: `You are an expert systems debugger. Help me diagnose and fix the following bug.

Please provide:
1. Root Cause Analysis (what conditions trigger this failure)
2. Immediate Fix (drop-in code fix)
3. Defensive Improvements (tests or architectural safeguards to prevent recurrence)

Bug report & logs:
{{selected_text}}`,
    tags: ['coding', 'debug', 'troubleshooting'],
    favorite: false,
    variables: [],
    createdAt: '2026-09-14T00:00:00.000Z',
    updatedAt: '2026-09-14T00:00:00.000Z',
    usage: { count: 0 },
  },
];
