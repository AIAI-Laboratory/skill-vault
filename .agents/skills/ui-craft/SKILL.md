---
name: ui-craft
description: Build or improve user interfaces in this repository when visual quality, layout, or interaction design matters. Use the existing React, shadcn/Base UI, and Tailwind CSS 4 stack.
---

# UI Craft

Create interfaces that look intentional, fit the product, and remain easy to use. Avoid generic dashboard styling and decorative polish that does not help the user.

## Before editing

- Read the component and styles being changed, then identify the main user task, available content, and the narrowest screen size the UI must support.
- Keep the repository's React + shadcn/Base UI + Tailwind CSS 4 stack. Reuse components under `src/components/ui/`, design tokens in `src/index.css`, and existing interaction patterns. Do not add a UI dependency for styling.
- Preserve working behavior, keyboard access, labels, validation, loading/error/empty states, and responsive behavior. Do not replace real product content with placeholder copy to make a mockup look cleaner.

## Design decisions

- Choose a clear visual direction from the product and its users before styling. Use hierarchy, spacing, typography, and a small number of meaningful color roles to express it consistently.
- Use sentence case for headings, buttons, tabs, and labels. Avoid all-caps text and uppercase tracking unless it is an established brand treatment already present in the product.
- Do not add eyebrow/kicker text above a page heading (for example, “Your prompt workspace”), or extra marketing descriptions and subtitles. Keep the existing useful copy; add new explanatory copy only when the user asks for it or the interface needs it to complete a task.
- Use comfortable, readable font sizes and line heights. Keep secondary text legible instead of shrinking it to fit more content.
- Give sections and controls enough space to breathe. Use consistent, generous spacing and clear grouping; do not compress the layout just to show more above the fold.
- Make the primary action and current state obvious. Group related information; keep secondary actions quiet and close to the item they affect.
- Prefer clear alignment and a deliberate spacing scale over piles of cards, borders, pills, shadows, gradients, or oversized headings. Use a card only when it communicates a real grouping or surface.
- Use the existing theme variables and light/dark behavior. Avoid one-off colors and arbitrary radii when a token or existing component fits.
- Keep text concise but specific. Give controls visible labels or accessible names; do not rely on placeholder text, color, or icons alone.
- On narrow layouts, preserve the content order and actions; allow text to wrap and avoid fixed widths or horizontal overflow.
- Use motion only to communicate a state change. Honor reduced-motion preferences when adding nontrivial animation.

## Finish

- Review the rendered result at the target narrow and wide sizes when a browser preview is available. Fix visible overflow, clipping, weak contrast, and inconsistent spacing before finishing.
- Keep the change limited to the requested UI. Summarize any visual behavior that could not be checked.
