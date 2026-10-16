<p align="center">
  <img src="./logo.png" alt="Skill Vault Logo" width="160" />
</p>

<h1 align="center">Skill Vault</h1>

<p align="center">
  <strong>Universal local-first skill and prompt layer for AI on the web.</strong><br>
  Save once. Use with any AI.
</p>

---

## 🌟 Overview

Skill Vault is a Manifest V3 Chrome Extension that bridges the gap between your personal prompt library and web-based AI chat interfaces (**ChatGPT**, **Claude**, **Gemini**).

- 📦 **Local-First Architecture:** All skills and settings are stored directly in your browser (`chrome.storage.local`). Zero analytics or tracking. Optional AI formatting calls Gemini only when requested.
- ⚡ **In-Composer `/skill` Palette:** Type `/skill` or `/skill <query>` inside ChatGPT, Claude, or Gemini to trigger a keyboard-driven command palette rendered in an isolated Shadow DOM.
- 🎯 **Compact Prompt Labels:** Picking or dropping a skill inserts a label such as `🏷️ /review`. The extension expands it to the prompt when you send; selecting a skill never sends a message automatically.
- 📝 **Right-Click to Save:** Highlight any text on any webpage, right-click, and choose **Save selection as Skill** to immediately draft a reusable skill.
- 🗂️ **Side Panel Management:** A compact, responsive library with collections, multi-tag search, favorites, pins, usage counts, recently used skills, duplication, and JSON backups.

---

## What's new in 0.2.0

- **Consistent, minimal UI:** Dark mode with orange accents, compact skill rows, clear page/section/field hierarchy, and 40px inputs and dropdowns. Settings, the editor, the library, and Trash share the same layout conventions on desktop and mobile.
- **Faster organization:** Collections, Recently used, usage-based sorting, pins, duplicate skills, and selectable or newly created tags.
- **Multi-tag filtering and pagination:** Combine tags, text, commands, collections, and favorites; choose 5, 10, 20, or 50 skills per page.
- **Drag to chat:** Drag a skill into a supported composer to insert a compact `🏷️ /command` label. Existing draft text is preserved, and prompts expand when sent.
- **Clearer feedback and settings:** Copy feedback stays above the Copy button; other notifications use status colors, and deletion offers Undo. Custom provider URLs and the Gemini API key field are visible directly in Settings.

## 🚀 Quick Start & Installation

### Option 1: Direct Install via Release ZIP (Recommended for Users)

1. Download the latest **`skill-vault.zip`** from [GitHub Releases](https://github.com/AIAI-Laboratory/skill-vault/releases).
2. Extract the ZIP file into a permanent folder on your computer (e.g., `Documents/SkillVault`).
   > ⚠️ **Note:** Do not delete or move this folder after installation, as the browser loads the extension files directly from it.
3. Open your Chromium-based browser and navigate to the extensions page:
   - **Chrome / Cốc Cốc:** `chrome://extensions`
   - **Edge:** `edge://extensions`
   - **Brave:** `brave://extensions`
4. Toggle **Developer mode** in the top-right corner.
5. Click **Load unpacked** (_Tải tiện ích đã giải nén_).
6. Select the extracted `SkillVault` folder (containing `manifest.json`).
7. Click the extension puzzle icon in your browser toolbar and **Pin** Skill Vault for quick access!

> **How to update:** Download the newest release zip, extract and overwrite the folder, then click the **Reload (🔄)** button on the extension card in `chrome://extensions`. Reload open chat pages too so they use the updated content script.

---

### Option 2: Build from Source (For Developers)

```bash
# Install dependencies
npm install

# Generate PNG icons from public/icons/icon.svg
npm run generate-icons

# Run test suite
npm run test

# Build extension to /dist
npm run build

# Or build and package into zip
npm run package
```

Then load the `skill-vault/dist` directory into `chrome://extensions` using **Load unpacked**.

---

## 💻 How to Use

### 1. Managing Skills (Side Panel)

- Click the **Skill Vault** extension icon in your toolbar to open the Chrome Side Panel.
- Browse curated seed skills (**Code Review**, **Explain Simply**, **Professional Rewrite**, **Bug Investigator**).
- Click **New skill** to create a prompt. Enter its name and content first; the shortcut is optional. Choose a collection and tags under **Details**, and use the star beside the title to mark it as a favorite. Changes are stored only after **Save skill**.
- Click anywhere in a skill row to expand its prompt. Copy, favorite, tag, and menu controls remain independent of expansion, and the expanded prompt stays selectable.
- Click **Copy** to copy the prompt content. A small **Copied** label confirms success above that button.
- Use variables like `{{selected_text}}`, `{{current_date}}`, `{{page_title}}`, `{{page_url}}`.
- Choose **••• → Move to trash** to delete a skill. Use **Undo** in the notification or open **Trash** using the header icon to restore it within 24 hours; after that it is permanently deleted. If the browser is closed or the device is asleep, overdue trash is cleaned up when the extension runs again. Trashed skills are excluded from search, favorites, and JSON backups.

### Collections, tags, recent skills, and sorting

- Open **Filters** beside Search to choose a collection, **Recently used**, or a sort order: newest, name, most used, recently used, or recently edited. These work with tags, favorites, and pagination. **Reset** clears the filters and restores the default order.
- Set **Collection** in the skill editor. Choose an existing collection, select **+ New collection…** to create one, or choose **Unassigned**. Older skills without a collection use a matching category tag until you assign one.
- A successful Copy or insertion in a chat increments the usage count and updates Recently used. Opening a prompt does not count as usage. Copying does not change the last edited date.
- In a skill's **•••** menu, choose **Pin to top**, **Unpin**, or **Duplicate skill**. Pins take priority within the selected view and sort order. A duplicate opens as an unsaved copy with the same prompt, collection, tags, variables, and provider rules; its shortcut is empty, and its favorite, pin, and usage start fresh. Save to create it or cancel to discard it.
- In the editor, choose existing tags or create new ones from **Choose or create tags**. Remove a selected tag with its × button. Tags and collections are saved with the skill.
- Select multiple tags in the quick filters or Filters popup to match skills containing **all** selected tags. Search also combines terms: `#coding #review` matches both tags exactly; `review #coding` combines text with a tag. Spaces or commas separate search terms.
- JSON backups retain collections, pins, and usage statistics.

### Pagination

Use **Per page** below the skill list to show **5, 10, 20, or 50** skills (default: 10). The list shows the result range and total, and the footer provides previous/next controls. Search and filter changes return to page 1. Deleting the last skill on a page keeps the current page valid.

### Drag a skill into chat

1. Open a supported chat page and the Skill Vault side panel.
2. Drag a skill row into the chat composer. The category icon becomes a drag grip on hover, and an eligible composer gets an orange outline.
3. Drop to insert a compact label, such as **`🏷️ /review`**. Skills without a shortcut use their name as the label.
4. Continue writing, then send when ready. The extension expands the label into the rendered prompt before sending.

Dropping preserves existing draft text and replaces a trailing `/skill` command when present. A successful insertion counts once as usage; canceled drags do not. Files and ordinary text retain the chat site's normal drop behavior. Outside supported chat pages, dragging inserts only the label; expansion requires the extension's content script on an enabled chat provider.

### Settings

Open the **Settings** icon in the header. The settings page groups **Appearance**, **AI connections**, **Improve by AI**, and **Back up your skills**. Changes to theme and provider toggles save immediately; adding a provider and saving an API key use their respective buttons.

The **Custom provider URL** and **Gemini API key** inputs are always visible. Choose **Light**, **Dark**, or **System** for appearance. Export and import are available under **Back up your skills**; backups retain skill metadata but exclude credentials.

Every side-panel screen includes a footer with **© 2026 AIAI** and the extension version, kept in sync with `package.json`.

### Improve by AI with Gemini

Open **Settings → Improve by AI** to save or manage a Gemini API key. Allow access to the Gemini API when Chrome asks. Keys are stored locally, separately from settings and JSON backups, and can be replaced or removed there.

Write your prompt and click **Improve by AI** next to the Prompt label. Without a saved key, the button is disabled and its tooltip explains how to enable it. The formatter uses `gemini-3.5-flash-lite` with medium thinking and structured JSON output ([Gemini model documentation](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite)). It improves prompt wording and structure while preserving the original intent and requirements, fills missing name/description/shortcut fields, and suggests relevant tags using the current vault. Generated shortcuts are checked against existing and reserved shortcuts; existing tags are reused.

The review popup opens automatically when Gemini returns suggestions. Review the result, choose **Apply format** or **Discard**, then **Save skill** when ready. Both short and detailed prompts can be rephrased for clarity, grammar, concision, and organization. Gemini is instructed to retain the original meaning, language, scope, constraints, and desired output without inventing requirements or guessing ambiguous details. If no useful, meaning-preserving edit is available, it keeps the prompt unchanged. The app rejects empty improvements and changes to code, URLs, or template variables. Meaning preservation relies on the model instructions and your review; literal checks cannot establish semantic equivalence. Your entered metadata stays intact; tags may be added. The current prompt and library metadata (names, descriptions, shortcuts, tags) are sent to Gemini, without sending other skills' prompt bodies. Normal skill editing works without an API key.

### Custom Chat Providers

Open **Settings → AI connections**, enter an HTTP or HTTPS chat URL in **Custom provider URL**, and click **Add**. Grant access to that website when the browser asks, then reload the chat page and type `/skill`.

URLs are saved by origin (scheme, hostname, and port); paths, queries, and fragments are removed. Local chat apps such as `http://localhost:3000` are supported. Custom providers use standard textareas and contenteditable inputs; websites with custom editors, shadow-root editors, or embedded frames may need a dedicated adapter. Remove a provider using its trash button to stop the palette on that origin.

After updating an unpacked extension, reload it at `chrome://extensions` before adding providers so Chrome picks up the new optional site permissions.

### 2. Triggering `/skill` in AI Chats

1. Navigate to [ChatGPT](https://chatgpt.com), [Claude](https://claude.ai), or [Gemini](https://gemini.google.com).
2. Click into the message prompt box.
3. Type:
   ```text
   /skill
   ```
   or filter directly:
   ```text
   /skill review
   ```
4. Use <kbd>↑</kbd> and <kbd>↓</kbd> to navigate, and press <kbd>Enter</kbd> to insert the compact skill label into the composer. Click a result to select it, or use <kbd>Esc</kbd> to close the palette. The prompt is expanded when you send.

### 3. Save Text from Any Webpage

1. Highlight text on any page (e.g. an interesting article, prompt, or code snippet).
2. Right-click and choose **"Save selection as Skill"**.
3. The Side Panel will open with a draft prompt ready to name and save!

---

## 🛠️ Tech Stack & Architecture

- **Manifest V3:** Background Service Worker (`src/background/`)
- **UI Framework:** React 19 + shadcn/ui (Base UI) + Tailwind CSS 4 (`src/sidepanel/`)
- **Content Runtime:** Vanilla TypeScript + Web Components & Shadow DOM (`src/content/`)
- **AI Adapters:** Modular adapter engine for ChatGPT, Claude, Gemini, and Generic fallback (`src/adapters/`)
- **Build System:** Vite (`scripts/build.mjs`)
- **Testing:** Vitest (`tests/`)

---

## 🧪 Development Commands

To preview the management UI locally, run `npm run dev` and open
`http://localhost:5173/src/sidepanel/index.html` (use the port printed by Vite).
The dev preview stores its own vault in browser localStorage, separately from the
installed extension. If the preview cannot find the Chrome extension API, it uses
this local development vault rather than showing a connection error. This fallback
is development-only. Chat integration, compact-label expansion, and context-menu
actions require loading the built extension in Chrome; the local management
preview alone does not install chat integration.

```bash
# Run tests
npm test

# Typecheck
npm run typecheck

# Build bundle to /dist
npm run build

# Package extension into zip archive
npm run package
```
