# Function documentation

## Required coverage

Document every function you create or modify, regardless of its size, complexity,
visibility, or whether its name seems self-explanatory. There are no exceptions for
one-line helpers, private functions, arrow functions, function expressions, class
methods, constructors, accessors, React components, hooks, event handlers, anonymous
callbacks, test callbacks, or functions in scripts and configuration files.

Apply this rule to new and modified functions in the current task. Do not expand a
focused change into a documentation rewrite of unrelated existing functions. Do not
edit generated or third-party code to add comments; document functions in the
maintained source instead.

## Format and content

Use [TSDoc](https://tsdoc.org/) for TypeScript and TSX, and
[JSDoc](https://jsdoc.app/about-getting-started) for JavaScript and MJS. Write English
documentation in a `/** ... */` block immediately before the function declaration,
the variable or member holding the function, or the inline callback expression.
An ordinary `//` or `/* ... */` comment does not satisfy this rule.

- Start with a concise sentence describing the function's purpose and observable
  behavior. Explain intent instead of merely repeating the function name.
- Add `@param name - description` for each parameter, explaining its meaning and
  relevant constraints, units, defaults, or optional behavior. For destructured
  parameters, describe the input object and relevant fields in the parameter text;
  use a named parameter when necessary to make the documentation unambiguous.
- Add `@returns` when the function returns a value, including JSX, or a promise that
  resolves to a value. Explain the result, including meaningful empty or missing
  states. For `void` and `Promise<void>`, describe side effects and asynchronous
  completion in the summary or `@remarks` instead of adding an empty return tag.
- Add `@typeParam` for each TypeScript generic parameter.
- Use `@throws` for errors callers need to handle, including promise rejections.
  Describe the condition that causes each error.
- Use `@remarks` for relevant side effects, mutations, permissions, ordering,
  asynchronous behavior, and other constraints. Add `@example` when usage is not
  obvious from the contract.
- In TypeScript, keep types in the signature; do not duplicate them with JSDoc
  `{Type}` annotations. In JavaScript, use JSDoc type annotations where needed to
  describe the contract.

Keep documentation proportional to the contract: a parameterless function returning
`void` may need only a single summary line, but it still needs a doc comment. Omit
inapplicable tags, never the comment itself. Keep comments accurate whenever behavior
or signatures change; avoid placeholders, stale descriptions, and unsupported claims.

For an inline callback, place its own doc comment immediately before the callback
expression. If formatting or nesting makes this unclear, extract it into a documented
named function without changing its behavior. Documentation on the enclosing function
does not replace documentation on nested functions or callbacks.

## Examples

Even a one-line helper must be documented:

```ts
/**
 * Removes surrounding whitespace from a skill name before validation.
 *
 * @param name - The raw skill name supplied by the user.
 * @returns The name with leading and trailing whitespace removed.
 */
const trimSkillName = (name: string): string => name.trim();
```

A parameterless function with no return value can use a short comment:

```ts
/** Moves keyboard focus to the skill search input. */
function focusSkillSearch(): void {
  document.querySelector<HTMLInputElement>('#skill-search')?.focus();
}
```

## Review checklist

Before finishing a change, inspect every new or modified function, including nested
and anonymous functions, and confirm it has its own doc comment in the required
format. Check parameter names, return values, errors, and side effects against the
implementation. These are mandatory authoring and review requirements; the current
lint configuration does not automatically enforce them.
