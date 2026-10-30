# Skill Vault Privacy Policy

Last updated: October 24, 2026

Skill Vault is a Chrome extension provided by AIAI Laboratory for creating, organizing, and reusing a personal library of AI prompts and skills. This policy describes the extension's data handling, including its optional Gemini-powered "Improve by AI" feature.

## Information handled by the extension

Skill Vault handles the information needed for the features you choose to use:

- **Prompt and skill content:** prompts you write, selected webpage text you save, and skill names, descriptions, shortcuts, tags, favorites, and template variables. Text you choose to save may include personal communications or other personal information. Skill Vault does not automatically collect your email inbox or entire chat history.
- **Page context:** the current page title, URL, and selected text when you invoke a relevant feature, such as saving a selection or using a page-context variable. Custom AI provider origins you configure are also stored. Skill Vault does not build or upload a general browsing-history log.
- **Local activity information:** per-skill usage counts and last-used timestamps for organizing your vault. The extension also handles composer input events to display the /skill palette and insert the prompt you select. It does not send keystroke logs or analytics to AIAI Laboratory.
- **Settings and temporary data:** interface preferences, custom provider origins, temporary selection drafts, and trashed skills awaiting deletion.
- **Authentication information:** a Gemini API key, only if you provide one to enable "Improve by AI". The key is stored locally, separately from settings and exported skill backups, and is used to authenticate requests to Google's Gemini API.

The extension does not require a Skill Vault account. It does not intentionally request your real name, email address, payment details, health information, or precise location for its core features. Avoid placing sensitive information in prompts unless you intend to use it with the relevant feature and provider.

## Local storage and use

The vault, settings, temporary drafts, API key, and usage information are stored in your browser using Chrome's local extension storage. The extension does not provide an AIAI Laboratory cloud-sync service or send your vault to a developer-operated server. Skill Vault does not include analytics, advertising, or tracking services.

The extension uses this information to manage your prompt library, search and rank skills, save selected text, expand template variables, and insert prompts into AI chat composers. Inserting a prompt does not automatically send the chat message; you decide whether to submit it to the chat website.

## Optional Gemini formatting

"Improve by AI" is optional. To use it, you provide your own Gemini API key and grant access to the Gemini API. When you click "Improve by AI", the extension sends the current draft, including its prompt and metadata, plus existing skill names, descriptions, shortcuts, and tags, directly to Google's Gemini API over HTTPS. Other saved skills' full prompt bodies are not included in this formatting request. The API key is used to authenticate the request.

Google processes these requests under the terms and privacy rules applicable to your Gemini API use. Data retention and use by Google may depend on your account, billing status, and applicable service terms. Review the [Gemini API additional terms](https://ai.google.dev/gemini-api/terms) and [Google Privacy Policy](https://policies.google.com/privacy) before sending sensitive content. Skill Vault does not promise that data sent to Google is immediately deleted or excluded from all provider uses.

Gemini returns suggested prompt text and metadata. The extension treats these responses as data, displays them for your review, and does not execute them as program code. You choose whether to apply suggestions and save the skill. Normal skill editing and insertion work without Gemini.

## AI chat websites and custom providers

Skill Vault runs its packaged content script on supported AI chat websites to show the /skill palette and insert selected prompts. You can optionally add a custom HTTP or HTTPS chat origin and grant access to that origin. Removing a custom provider stops registration of the extension's custom-provider content script for that origin.

Text you submit to ChatGPT, Claude, Gemini, or another chat provider is handled by that provider under its own policies. A custom provider may use HTTP, including a locally hosted chat application; the security and data handling of that provider are controlled by its operator. Skill Vault's direct Gemini API requests use HTTPS.

## Sharing and limited use

AIAI Laboratory does not sell extension user data or transfer it for advertising, profiling, creditworthiness, or lending decisions. The extension uses and transfers data only to provide its stated prompt-management features, including optional user-requested Gemini formatting and interaction with user-selected chat providers.

Skill Vault's use of information received through Chrome APIs adheres to the Chrome Web Store User Data Policy, including the Limited Use requirements. AIAI Laboratory does not receive a copy of your local vault or have routine access to its contents through the extension.

## Retention and your controls

- You can edit skills, change settings, remove your Gemini API key, and remove custom providers in the extension.
- Deleted skills remain in the local Trash for up to 24 hours so you can restore them. Expired entries are permanently removed when cleanup runs. If Chrome is closed, the device is asleep, or cleanup cannot run, deletion may occur when the extension runs again.
- Removing the Gemini API key disables "Improve by AI" until you add a key again. To revoke the credential itself, use the provider's API-key management page.
- You can export skill backups as JSON files. Keep these files private; they contain the exported skill content and metadata. The extension excludes the Gemini API key and trashed skills from these backups.
- Chrome removes the extension's local storage when the extension is uninstalled. Uninstalling does not delete exported files or information already sent to an AI provider.
- Data already sent to Google or another provider is governed by that provider's retention rules and deletion controls.

## Security

The extension packages its executable scripts with the extension and does not download remote JavaScript or WebAssembly for execution. Local extension storage is not an encrypted password vault, and Skill Vault does not add application-level encryption to that storage. Protect your browser profile, device, exported backups, and API key. Direct Gemini requests use HTTPS; the security of custom chat services depends on the origins you choose.

## Changes and contact

This policy may be updated when the extension's behavior changes. The date at the top identifies the latest revision. For questions or to report a privacy issue, contact AIAI Laboratory through the [Skill Vault repository](https://github.com/AIAI-Laboratory/skill-vault). Do not post API keys, private prompts, or other sensitive information in public issues.
