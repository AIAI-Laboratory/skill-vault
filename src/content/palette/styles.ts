// Match the side panel's semantic theme tokens, scoped to the Shadow DOM host.
const DARK_TOKENS = `
  color-scheme: dark;
  --sv-background: oklch(0.175 0.005 65);
  --sv-foreground: oklch(0.94 0.01 75);
  --sv-card: oklch(0.215 0.006 65);
  --sv-primary: oklch(0.77 0.13 48);
  --sv-primary-foreground: oklch(0.2 0.025 45);
  --sv-muted: oklch(0.245 0.006 65);
  --sv-muted-foreground: oklch(0.68 0.012 75);
  --sv-border: oklch(0.32 0.009 65);
`;

export const PALETTE_STYLES = `
:host {
  all: initial;
  position: fixed;
  z-index: 2147483647;
  font-family: "Geist Variable", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  font-size: 13px;
  line-height: 1.5;
  text-align: left;
  direction: ltr;
  color-scheme: light;
  --sv-background: oklch(0.975 0.004 75);
  --sv-foreground: oklch(0.23 0.01 65);
  --sv-card: oklch(1 0 0);
  --sv-primary: oklch(0.57 0.16 38);
  --sv-primary-foreground: oklch(0.99 0.005 75);
  --sv-muted: oklch(0.947 0.006 75);
  --sv-muted-foreground: oklch(0.49 0.016 65);
  --sv-border: oklch(0.89 0.01 75);
  color: var(--sv-foreground);
}

:host([data-theme="dark"]) { ${DARK_TOKENS} }
@media (prefers-color-scheme: dark) {
  :host([data-theme="system"]) { ${DARK_TOKENS} }
}

*, *::before, *::after { box-sizing: border-box; }
button, p, ul { margin: 0; }
svg { display: block; width: 16px; height: 16px; flex-shrink: 0; }

.sv-palette {
  width: 100%;
  max-height: var(--sv-max-height, 420px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--sv-border);
  border-radius: 16px;
  background: var(--sv-card);
  box-shadow: 0 16px 48px rgb(0 0 0 / 24%), 0 2px 8px rgb(0 0 0 / 12%);
}

.sv-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
  gap: 12px;
  padding: 12px 14px;
}
.sv-brand { display: flex; min-width: 0; align-items: center; gap: 9px; }
.sv-brand-mark {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: 9px;
  background: var(--sv-primary);
  color: var(--sv-primary-foreground);
}
.sv-brand-name { font-size: 13px; font-weight: 650; letter-spacing: -0.2px; }
.sv-brand-description { font-size: 10px; color: var(--sv-muted-foreground); }
.sv-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: var(--sv-muted-foreground);
  cursor: pointer;
}
.sv-close:hover { background: var(--sv-muted); color: var(--sv-foreground); }
.sv-close:focus-visible { outline: 2px solid var(--sv-primary); outline-offset: 2px; }
.sv-search {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  gap: 8px;
  padding: 9px 14px;
  border-block: 1px solid var(--sv-border);
  color: var(--sv-muted-foreground);
  background: var(--sv-background);
}
.sv-search-text { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; }
.sv-search-text strong { color: var(--sv-foreground); font-weight: 500; }
.sv-list {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: thin;
  scrollbar-color: var(--sv-border) transparent;
  list-style: none;
  padding: 6px;
}
.sv-item {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  gap: 10px;
  padding: 10px;
  border: 1px solid transparent;
  border-radius: 10px;
  cursor: pointer;
  user-select: none;
}
.sv-item.selected {
  border-color: color-mix(in oklch, var(--sv-primary) 30%, transparent);
  background: color-mix(in oklch, var(--sv-primary) 10%, var(--sv-card));
}
.sv-item-body { flex: 1; min-width: 0; }
.sv-item-title-row { display: flex; align-items: center; gap: 6px; min-width: 0; }
.sv-item-name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; font-weight: 600; }
.sv-fav-star { color: var(--sv-primary); }
.sv-fav-star svg { width: 12px; height: 12px; fill: currentColor; }
.sv-shortcut-badge {
  margin-left: auto;
  max-width: 40%;
  flex-shrink: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  border: 1px solid var(--sv-border);
  border-radius: 5px;
  padding: 1px 5px;
  font: 10px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace;
  color: var(--sv-muted-foreground);
  background: var(--sv-background);
}
.sv-item-desc {
  margin-top: 4px;
  color: var(--sv-muted-foreground);
  font-size: 11px;
  line-height: 1.5;
  overflow-wrap: anywhere;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.sv-item-tags { display: flex; gap: 4px; margin-top: 6px; overflow: hidden; }
.sv-tag {
  max-width: 45%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  padding: 1px 5px;
  border-radius: 4px;
  color: var(--sv-muted-foreground);
  background: var(--sv-muted);
  font-size: 10px;
}
.sv-insert-icon { color: var(--sv-primary); opacity: 0; flex-shrink: 0; }
.sv-item.selected .sv-insert-icon { opacity: 1; }
.sv-footer {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
  gap: 8px;
  padding: 9px 14px;
  border-top: 1px solid var(--sv-border);
  background: var(--sv-background);
  color: var(--sv-muted-foreground);
  font-size: 10px;
}
.sv-hints { display: flex; flex-wrap: wrap; align-items: center; gap: 9px; }
.sv-hints > span { display: flex; align-items: center; gap: 4px; }
.sv-kbd { border: 1px solid var(--sv-border); border-radius: 4px; padding: 0 4px; font: 10px/1.5 ui-monospace, monospace; color: var(--sv-foreground); background: var(--sv-muted); }
.sv-empty { min-height: 0; overflow-y: auto; padding: 24px 16px; text-align: center; color: var(--sv-foreground); list-style: none; }
.sv-empty-icon { display: flex; justify-content: center; margin-bottom: 8px; color: var(--sv-muted-foreground); }
.sv-empty-title { font-size: 13px; font-weight: 600; }
.sv-empty-hint { margin-top: 4px; font-size: 11px; color: var(--sv-muted-foreground); overflow-wrap: anywhere; }
`;
