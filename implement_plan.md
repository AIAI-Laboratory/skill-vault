# Skill Vault

## Architecture & Product Specification v0.1

**Product type:** Browser Extension
**Initial platform:** Chrome / Chromium / Edge
**Architecture:** Local-first, Manifest V3
**Primary interaction:** `/skill` command palette
**MVP backend:** None
**Recommended minimum Chrome version:** 116

---

# 1. Product Vision

Skill Vault là **universal skill layer cho AI trên web**.

Người dùng có thể:

* lưu prompt/skill/template;
* lấy một đoạn text trên web và lưu thành skill;
* mở bất kỳ AI chat được hỗ trợ;
* gõ `/skill`;
* tìm skill;
* chọn skill;
* Skill Vault render skill;
* chèn trực tiếp vào ô chat;
* người dùng kiểm tra rồi tự bấm Send.

Core principle:

> Save once. Use with any AI.

Skill Vault **không phải AI chatbot** và cũng không phải prompt marketplace ở MVP.

Skill Vault là lớp nằm giữa:

```text
USER
  │
  ▼
SKILL VAULT
  │
  ├── Skill Library
  ├── Slash Commands
  ├── Context Resolver
  └── AI Adapters
  │
  ▼
ChatGPT / Claude / Gemini / ...
```

---

# 2. Product Goals

## P0 — MVP Goals

Skill Vault phải làm thật tốt 5 việc:

1. Create / edit / delete / search skill.
2. Bôi đen text → Right Click → Add to Skill Vault.
3. Phát hiện AI chat được hỗ trợ.
4. Gõ `/skill` → mở command palette.
5. Chọn skill → chèn nội dung vào AI input.

## P1 — Sau MVP

* Skill variables.
* Slash shortcut riêng như `/review`.
* Favorites / tags.
* Import / export Markdown.
* Generic AI adapter.
* Keyboard navigation.
* Usage history.

## P2 — Future

* Cloud sync.
* Team vault.
* Community skill packs.
* Skill marketplace.
* Skill chaining.
* Workflow.
* Agent integration.
* GitHub sync.
* SKILL.md compatibility.
* Shared skill URLs.

---

# 3. Non-Goals cho MVP

Không làm trong bản đầu:

```text
AI model/API calls
Automatic Send
Chat history collection
Full-page scraping
Cloud account
Marketplace
Teams
Billing
Vector database
RAG
Agent automation
Cross-tab workflows
```

Việc giới hạn này giúp MVP nhỏ, dễ review Chrome Web Store và giảm đáng kể privacy risk.

---

# 4. Core Architecture

```text
┌──────────────────────────────────────────────────────────────┐
│                        Browser                               │
│                                                              │
│  ┌───────────────── Web Page ────────────────────────────┐   │
│  │                                                       │   │
│  │ ChatGPT / Claude / Gemini / Generic AI                │   │
│  │                                                       │   │
│  │       ┌───────────────────────────┐                   │   │
│  │       │ Skill Vault Content App   │                   │   │
│  │       │                           │                   │   │
│  │       │ ┌───────────────────────┐ │                   │   │
│  │       │ │ AI Detector           │ │                   │   │
│  │       │ ├───────────────────────┤ │                   │   │
│  │       │ │ Input Observer        │ │                   │   │
│  │       │ ├───────────────────────┤ │                   │   │
│  │       │ │ Slash Engine          │ │                   │   │
│  │       │ ├───────────────────────┤ │                   │   │
│  │       │ │ Command Palette       │ │                   │   │
│  │       │ ├───────────────────────┤ │                   │   │
│  │       │ │ Prompt Injector       │ │                   │   │
│  │       │ └───────────────────────┘ │                   │   │
│  │       └───────────┬───────────────┘                   │   │
│  │                   │                                   │   │
│  └───────────────────┼───────────────────────────────────┘   │
│                      │ chrome.runtime messaging               │
│                      ▼                                       │
│            ┌───────────────────────┐                         │
│            │ MV3 Service Worker    │                         │
│            │                       │                         │
│            │ Skill Service         │                         │
│            │ Context Menu Service  │                         │
│            │ Migration Service     │                         │
│            │ Settings Service      │                         │
│            └──────────┬────────────┘                         │
│                       │                                      │
│             ┌─────────▼────────────┐                         │
│             │ chrome.storage      │                         │
│             │                     │                         │
│             │ local               │                         │
│             │ session             │                         │
│             │ sync (settings)     │                         │
│             └─────────┬───────────┘                         │
│                       │                                      │
│       ┌───────────────▼──────────────────┐                  │
│       │ Skill Vault Side Panel           │                  │
│       │                                  │                  │
│       │ Library                          │                  │
│       │ Search                           │                  │
│       │ Skill Editor                     │                  │
│       │ Settings                         │                  │
│       └──────────────────────────────────┘                  │
└──────────────────────────────────────────────────────────────┘
```

---

# 5. Browser Architecture

Skill Vault dùng **Manifest V3**.

Background component là extension service worker.

Service worker không được xem như một server process sống liên tục. Chrome có thể terminate worker sau thời gian inactivity, vì vậy state quan trọng không được giữ chỉ trong global variables; state phải persist trong storage.

### Service Worker

Responsibilities:

```text
storage coordination
context menu
skill CRUD
settings
schema migration
import/export orchestration
message routing
```

Không chịu trách nhiệm:

```text
DOM detection
slash detection
command palette rendering
AI input mutation
```

Những việc đó thuộc content layer.

---

# 6. Content Script Architecture

Content script chạy trong trang AI.

Chrome content scripts mặc định hoạt động trong **isolated world**, tách execution environment của extension khỏi JavaScript của website. Đây nên là execution model mặc định của Skill Vault.

```text
ContentRuntime
│
├── AdapterRegistry
├── AIProviderDetector
├── ChatInputObserver
├── SlashCommandEngine
├── SkillSearchClient
├── VariableResolver
├── PromptRenderer
├── InputInjector
└── PaletteController
```

Không inject logic trực tiếp vào `MAIN` world trừ khi thực sự bắt buộc.

---

# 7. AI Adapter Layer

Đây là module quan trọng nhất để extension sống được lâu.

Không viết logic kiểu:

```javascript
if (location.hostname === "chatgpt.com") {
   // everything
}
```

Thay vào đó:

```text
AIAdapter
    │
    ├── ChatGPTAdapter
    ├── ClaudeAdapter
    ├── GeminiAdapter
    └── GenericAdapter
```

Interface:

```ts
interface AIAdapter {
  id: string;

  match(context: PageContext): number;

  findComposer(): ComposerHandle | null;

  readComposer(): string;

  insertText(text: string): Promise<void>;

  getCaretContext?(): CaretContext;

  observeComposer(
    callback: ComposerChangeCallback
  ): DisposeFunction;
}
```

`match()` trả về confidence:

```text
0     = không match
1.0   = chắc chắn provider
```

Ví dụ:

```text
ChatGPTAdapter.match() = 1.0
GenericAdapter.match() = 0.45
```

---

# 8. Provider Detection

Detection sử dụng nhiều tín hiệu:

```text
hostname
URL
DOM signature
ARIA labels
known composer structure
app-specific attributes
contenteditable structure
```

Không dùng text UI duy nhất vì:

* localization;
* A/B testing;
* website thay wording;
* accessibility labels có thể thay đổi.

Detection flow:

```text
Page Loaded
     │
     ▼
Known Domain?
  │       │
 yes      no
  │       │
  ▼       ▼
Known    Generic
Adapter  Detection
  │       │
  └───┬───┘
      ▼
Find Composer
      │
      ▼
Observe composer lifecycle
```

---

# 9. DOM Resilience

AI website thường là SPA và DOM thay đổi mà không reload trang.

Vì vậy không được detect composer chỉ một lần.

Dùng:

```text
MutationObserver
+
route observation
+
focus events
```

Flow:

```text
DOM mutation
    │
    ▼
debounce
    │
    ▼
adapter.findComposer()
    │
    ├── same composer → ignore
    │
    └── new composer
             │
             ▼
       attach listeners
```

Debounce recommendation:

```text
100–300 ms
```

Không scan toàn bộ DOM trên từng mutation.

---

# 10. Slash Engine

Slash Engine chỉ active khi:

```text
supported AI page
AND
composer detected
AND
composer focused
```

Không làm global keylogger.

State machine:

```text
IDLE
 │
 │ user types "/"
 ▼
POSSIBLE_COMMAND
 │
 │ matches "/skill"
 ▼
PALETTE_OPEN
 │
 ├── query changed → SEARCHING
 │
 ├── escape → IDLE
 │
 └── select skill
        │
        ▼
     INSERTING
        │
        ▼
       IDLE
```

Initial syntax:

```text
/skill
```

Supported:

```text
/skill
/skill review
/skill translate
```

Future:

```text
/review
/translate en
/debug
```

---

# 11. Slash Parsing Specification

Parser input:

```ts
type SlashParseResult =
  | { type: "none" }
  | {
      type: "skill_palette";
      query: string;
      range: TextRange;
    }
  | {
      type: "skill_shortcut";
      shortcut: string;
      args: string[];
      range: TextRange;
    };
```

Examples:

```text
"/"
→ none

"/skill"
→ skill_palette(query="")

"/skill code"
→ skill_palette(query="code")

"hello /skill"
→ none
```

MVP recommendation:

Slash command chỉ trigger khi command nằm từ đầu composer hoặc sau newline.

Điều này tránh mở palette khi user đang viết:

```text
visit https://example.com/skill
```

---

# 12. Command Palette

Command palette nằm gần composer.

UI:

```text
┌────────────────────────────────────┐
│ 🔍 Search skills                   │
├────────────────────────────────────┤
│ ★ Code Review                 ↵     │
│   Review source code               │
│                                    │
│   Professional Rewrite             │
│   Rewrite text professionally      │
│                                    │
│   Explain Simply                   │
│   Explain a topic clearly          │
└────────────────────────────────────┘
```

Keyboard:

```text
↑ ↓      Navigate
Enter    Insert
Esc      Close
Tab      optional autocomplete
```

Maximum initial results:

```text
8
```

Search ranking:

```text
exact shortcut
      ↓
name prefix
      ↓
name fuzzy
      ↓
tags
      ↓
description
      ↓
recent usage
```

---

# 13. Palette Isolation

Website CSS không được phá UI Skill Vault.

Recommendation:

```text
Host element
   │
   ▼
Shadow DOM
   │
   └── Skill Vault UI
```

Sử dụng Shadow DOM cho:

* command palette;
* toast;
* variable form;
* inline UI.

Không inject global CSS selectors như:

```css
button {}
input {}
div {}
```

---

# 14. Skill Entity

Canonical schema:

```ts
interface Skill {
  id: string;

  schemaVersion: number;

  name: string;
  description?: string;

  shortcut?: string;

  content: string;

  tags: string[];

  favorite: boolean;

  variables: SkillVariable[];

  providers?: ProviderRule[];

  createdAt: string;
  updatedAt: string;

  usage: {
    count: number;
    lastUsedAt?: string;
  };
}
```

Example:

```json
{
  "id": "sk_01JXYZ...",
  "schemaVersion": 1,
  "name": "Code Review",
  "description": "Review code for correctness and maintainability",
  "shortcut": "review",
  "content": "Review the following code:\n\n{{selected_text}}",
  "tags": ["coding", "review"],
  "favorite": true,
  "variables": [],
  "createdAt": "2026-09-14T10:00:00Z",
  "updatedAt": "2026-09-14T10:00:00Z",
  "usage": {
    "count": 0
  }
}
```

---

# 15. IDs

Không dùng skill name làm primary key.

Use:

```text
sk_<UUID/ULID>
```

Ví dụ:

```text
sk_01K4KVX01BTEH91FCAEMBVXXXXX
```

Name có thể trùng.

Shortcut phải unique.

---

# 16. Shortcut Rules

Valid:

```text
review
code-review
translate
explain2
```

Invalid:

```text
skill
Skill Name
code/review
/review
```

Reserved commands:

```text
skill
skills
help
settings
vault
```

Validation:

```regex
^[a-z0-9][a-z0-9-]{0,31}$
```

---

# 17. Variables

Syntax:

```text
{{variable_name}}
```

Built-in variables:

```text
{{selected_text}}
{{clipboard}}
{{page_title}}
{{page_url}}
{{current_date}}
{{provider}}
```

Custom example:

```text
Translate this text to {{language}}:

{{selected_text}}
```

Schema:

```ts
interface SkillVariable {
  key: string;
  label: string;

  type:
    | "text"
    | "textarea"
    | "select";

  required: boolean;

  defaultValue?: string;

  options?: string[];
}
```

---

# 18. Variable Resolution Pipeline

```text
Skill selected
      │
      ▼
Parse {{variables}}
      │
      ▼
Resolve automatic variables
      │
      ▼
Missing variables?
   │          │
   no        yes
   │          │
   │          ▼
   │      Variable Form
   │          │
   └──────┬───┘
          ▼
      Render Prompt
          │
          ▼
       Insert
```

Automatic variable values không được gửi ra server.

---

# 19. Skill Rendering Rules

Escaping không cần giống HTML template engine.

Skill content là plain text.

Unknown variable:

```text
{{foo}}
```

nếu required nhưng chưa resolve:

```text
BLOCK INSERT
```

nếu optional:

```text
replace ""
```

Nested variables không support:

```text
{{foo_{{bar}}}}
```

---

# 20. Input Injection Architecture

Đây là phần dễ lỗi nhất.

Các AI editor có thể dùng:

```text
<textarea>
contenteditable
ProseMirror
React-controlled input
custom editor
```

Vì vậy `element.value = text` chưa đủ.

`ComposerHandle` abstraction:

```ts
interface ComposerHandle {
  element: HTMLElement;

  kind:
    | "textarea"
    | "contenteditable"
    | "prosemirror"
    | "custom";

  adapterId: string;
}
```

Adapter chịu trách nhiệm implement insertion đúng editor.

Required behavior:

```text
Replace "/skill ..."
with rendered prompt
```

Không append mù vào cuối.

Sau insertion phải tạo đúng input/change events cần thiết để website nhận state mới.

---

# 21. Injection Safety Rule

Skill Vault **không tự click Send** ở MVP.

Flow:

```text
Select skill
    │
    ▼
Insert prompt
    │
    ▼
User reviews
    │
    ▼
User manually sends
```

Điều này:

* tránh gửi nhầm;
* dễ tạo trust;
* giảm automation risk;
* giảm lỗi khi skill render không đúng.

---

# 22. Right Click → Add Skill

Chrome cung cấp `contextMenus` API để extension thêm menu vào browser context menu; permission `contextMenus` phải được khai báo.

MVP menu:

```text
Skill Vault
└── Save selection as Skill
```

Trigger chỉ khi:

```text
context = selection
```

Flow:

```text
User selects text
       │
       ▼
Right click
       │
       ▼
Save selection as Skill
       │
       ▼
Service Worker
       │
       ▼
Draft Skill
       │
       ▼
Open Side Panel Editor
```

Initial values:

```text
name = ""
content = selectionText
tags = []
shortcut = ""
```

User chỉ cần đặt name rồi Save.

---

# 23. Side Panel

Side Panel là management interface chính.

Chrome Side Panel API cho phép extension đặt UI cạnh webpage. API được hỗ trợ cho MV3 từ Chrome 114; `sidePanel.open()` có từ Chrome 116 và phải được gọi trong ngữ cảnh user gesture.

Navigation:

```text
Vault
Search
Favorites
Recent
Tags
Settings
```

Main layout:

```text
┌──────────────────────────┐
│ Skill Vault        + New │
├──────────────────────────┤
│ 🔍 Search                │
├──────────────────────────┤
│ ★ Favorites              │
│                          │
│ Code Review              │
│ /review                  │
│                          │
│ Professional Rewrite     │
│ /rewrite                 │
│                          │
│ Explain Simply           │
│ /explain                 │
└──────────────────────────┘
```

---

# 24. Skill Editor

Fields:

```text
Name *
Description
Shortcut
Tags
Prompt *
Favorite
```

Advanced collapsed section:

```text
Variables
AI compatibility
Provider overrides
```

MVP có thể chưa expose provider overrides.

Buttons:

```text
Save
Cancel
Delete
Duplicate
```

Autosave không cần ở MVP.

---

# 25. Storage Strategy

Chrome extension `storage` API cung cấp local, session và sync storage. `storage.local` hiện có quota khoảng 10 MB, trong khi `storage.sync` nhỏ hơn nhiều, khoảng 100 KB tổng cộng và khoảng 8 KB/item.

Vì vậy:

```text
chrome.storage.local
├── skills
├── tags
├── usage metadata
└── migrations

chrome.storage.sync
└── small settings only

chrome.storage.session
└── transient runtime state
```

Không lưu toàn bộ skill library vào sync ở MVP.

---

# 26. Storage Keys

Không lưu một giant object duy nhất kiểu:

```text
skills = [10,000 skills]
```

Recommendation:

```text
skill:<id>
skill:<id>
skill:<id>

skill:index

settings

meta:schemaVersion
```

Example:

```json
{
  "skill:sk_01ABC": {
    "...": "..."
  }
}
```

Index:

```json
{
  "skill:index": [
    "sk_01ABC",
    "sk_01DEF"
  ]
}
```

Điều này giúp migration và update từng skill dễ hơn.

---

# 27. Storage Repository

UI và content scripts không truy cập storage trực tiếp tùy tiện.

Tạo interface:

```ts
interface SkillRepository {
  list(): Promise<Skill[]>;
  get(id: string): Promise<Skill | null>;

  create(input: CreateSkillInput): Promise<Skill>;

  update(
    id: string,
    patch: UpdateSkillInput
  ): Promise<Skill>;

  remove(id: string): Promise<void>;

  search(query: string): Promise<Skill[]>;
}
```

Implementation:

```text
ChromeSkillRepository
```

Sau này có thể thêm:

```text
CloudSkillRepository
GitHubSkillRepository
```

mà không phải đổi UI.

---

# 28. Messaging Architecture

Chrome hỗ trợ message passing giữa content scripts, service worker và extension pages. One-time messaging phù hợp cho hầu hết Skill Vault commands.

Message envelope:

```ts
interface Message<T = unknown> {
  id: string;

  type: MessageType;

  payload: T;

  version: 1;
}
```

Examples:

```text
SKILL_SEARCH
SKILL_GET
SKILL_CREATE
SKILL_UPDATE
SKILL_DELETE

SKILL_USED

SETTINGS_GET
SETTINGS_UPDATE

OPEN_EDITOR
```

Example:

```json
{
  "id": "msg_123",
  "version": 1,
  "type": "SKILL_SEARCH",
  "payload": {
    "query": "review"
  }
}
```

Response:

```json
{
  "id": "msg_123",
  "ok": true,
  "data": []
}
```

---

# 29. Internal Module Boundary

```text
UI
 │
 ▼
Application
 │
 ▼
Domain
 │
 ▼
Infrastructure
```

Recommended folder layout:

```text
skill-vault/
│
├── src/
│
│   ├── background/
│   │   ├── index.ts
│   │   ├── context-menu.ts
│   │   ├── message-router.ts
│   │   └── migration.ts
│   │
│   ├── content/
│   │   ├── index.ts
│   │   ├── runtime.ts
│   │   ├── slash/
│   │   │   ├── parser.ts
│   │   │   └── controller.ts
│   │   │
│   │   ├── palette/
│   │   ├── injector/
│   │   └── observers/
│   │
│   ├── adapters/
│   │   ├── adapter.ts
│   │   ├── registry.ts
│   │   ├── chatgpt.ts
│   │   ├── claude.ts
│   │   ├── gemini.ts
│   │   └── generic.ts
│   │
│   ├── sidepanel/
│   │   ├── App.tsx
│   │   ├── pages/
│   │   └── components/
│   │
│   ├── domain/
│   │   ├── skill.ts
│   │   ├── variables.ts
│   │   └── provider.ts
│   │
│   ├── application/
│   │   ├── create-skill.ts
│   │   ├── update-skill.ts
│   │   ├── search-skills.ts
│   │   └── render-skill.ts
│   │
│   ├── infrastructure/
│   │   ├── storage/
│   │   └── messaging/
│   │
│   └── shared/
│
├── manifest.json
└── tests/
```

---

# 30. Manifest v3 Draft

Conceptually:

```json
{
  "manifest_version": 3,

  "name": "Skill Vault",

  "version": "0.1.0",

  "minimum_chrome_version": "116",

  "permissions": [
    "storage",
    "contextMenus",
    "sidePanel"
  ],

  "background": {
    "service_worker": "background.js",
    "type": "module"
  },

  "side_panel": {
    "default_path": "sidepanel.html"
  },

  "content_scripts": [
    {
      "matches": [
        "https://chatgpt.com/*",
        "https://claude.ai/*",
        "https://gemini.google.com/*"
      ],

      "js": ["content.js"],

      "run_at": "document_idle"
    }
  ],

  "action": {
    "default_title": "Skill Vault"
  }
}
```

Content scripts có thể được khai báo bằng URL match patterns, và mặc định chạy trong isolated execution environment.

---

# 31. Permission Strategy

MVP request:

```text
storage
contextMenus
sidePanel
```

Host access chỉ dành cho AI sites hỗ trợ.

Không request:

```text
<all_urls>
tabs
history
clipboardRead
webRequest
cookies
```

nếu chưa thật sự cần.

Điểm này quan trọng cho trust.

Future generic-site mode có thể dùng optional host permissions.

---

# 32. Privacy Model

Core privacy guarantees:

```text
Skills stay local by default.

No chat history collection.

No conversation upload.

No keystroke analytics.

No AI API calls.

No automatic send.

No advertising tracker.
```

Skill Vault chỉ inspect input khi:

```text
supported composer
+
focused
```

Không tạo hệ thống ghi lại tất cả keyboard events trên webpage.

---

# 33. Security Boundaries

Website đang chạy phải được xem là **untrusted environment**.

Never trust data coming from page DOM.

Risks:

```text
XSS through skill rendering
malicious page manipulating extension UI
DOM spoofing
provider misdetection
unexpected HTML content
extension message abuse
```

Mitigations:

```text
render prompt as textContent
never innerHTML user skill content
validate all messages
validate IDs
restrict sender origin when required
Shadow DOM isolation
no eval()
no remote executable code
```

---

# 34. Prompt Content Rendering

Never:

```javascript
container.innerHTML = skill.content;
```

Use:

```javascript
container.textContent = skill.content;
```

Prompt is data, not HTML.

---

# 35. Functional Requirements

## FR-001 Create Skill

User can create skill containing:

```text
name
description
content
shortcut
tags
favorite
```

Acceptance:

```text
Given user creates valid skill
When Save is pressed
Then skill persists after browser restart.
```

---

## FR-002 Edit Skill

Changes must update:

```text
updatedAt
```

without changing:

```text
id
createdAt
```

---

## FR-003 Delete Skill

Deletion requires confirmation.

After deletion:

```text
skill search must not return it
shortcut becomes available
```

---

## FR-004 Search Skill

Search must cover:

```text
name
shortcut
tags
description
```

Target:

```text
< 50 ms
for 1,000 local skills
```

---

## FR-005 Save Selection

Given highlighted text:

```text
Right click
→ Save selection as Skill
```

must open editor with selected text pre-filled.

---

## FR-006 `/skill`

When user types:

```text
/skill
```

in supported AI composer:

```text
command palette opens
```

No command is sent to AI.

---

## FR-007 Search Palette

When user types:

```text
/skill code
```

palette filters matching skills.

---

## FR-008 Insert Skill

When skill selected:

```text
"/skill code"
```

is replaced by rendered skill content.

User's unrelated composer text must not be lost.

---

## FR-009 Keyboard Navigation

Palette supports:

```text
ArrowUp
ArrowDown
Enter
Escape
```

---

## FR-010 Provider Detection

System must expose:

```ts
{
  provider: "chatgpt",
  confidence: 1
}
```

to content runtime.

---

# 36. Non-Functional Requirements

## Performance

Content runtime target:

```text
initial execution < 50 ms CPU
```

under normal page conditions.

No continuous polling loop like:

```javascript
setInterval(scanDOM, 100);
```

Use event-driven observers.

---

## Reliability

DOM selector failure must not break host AI application.

All adapter operations wrapped:

```text
fail closed
```

Meaning:

```text
cannot safely identify composer
→ do nothing
```

---

## Accessibility

Palette:

```text
role="listbox"
```

Skill:

```text
role="option"
```

Support:

```text
keyboard only
screen readers
visible focus
```

---

## Compatibility

Initial matrix:

```text
Chrome 116+
Edge Chromium
```

Best-effort later:

```text
Brave
Arc
Firefox
```

---

# 37. Adapter Test Contract

Every AI adapter phải vượt cùng contract tests.

```text
detect provider
find composer
read composer
insert empty
insert plain text
insert multiline text
replace slash query
preserve prefix
preserve suffix
handle composer remount
handle route change
handle new conversation
```

---

# 38. Unit Tests

Core unit tests:

```text
slash parser
skill validation
shortcut validation
search ranking
variable parser
variable resolver
prompt renderer
storage repository
schema migration
message validation
```

---

# 39. Integration Tests

Using Playwright:

```text
mock textarea composer
mock contenteditable composer
mock SPA remount
mock provider switch
```

Then provider-specific smoke tests against real websites during development.

Do not make production tests depend solely on fragile CSS selectors.

---

# 40. Search Ranking

Suggested score:

```text
shortcut exact          +100
name exact               +90
name startsWith          +70
shortcut startsWith      +60
tag exact                +50
name contains            +40
description contains     +20
favorite                 +10
recent use               +0..10
```

Search result:

```ts
interface SkillSearchResult {
  skill: Skill;
  score: number;
}
```

---

# 41. Usage Data

Local-only:

```ts
usage: {
  count: number;
  lastUsedAt?: string;
}
```

Mục đích:

```text
Recent
Most Used
Search ranking
```

Không cần analytics server.

---

# 42. Import / Export

Recommended first format:

```text
JSON backup
```

V1 format:

```text
Markdown / SKILL.md
```

Example:

```markdown
---
name: Code Review
shortcut: review
tags:
  - coding
  - review
---

You are a senior software engineer.

Review:

{{selected_text}}
```

---

# 43. Schema Versioning

Every skill:

```text
schemaVersion
```

Global:

```text
meta:schemaVersion
```

Migration example:

```text
v1
 ↓
v2
 ↓
v3
```

Migration phải:

```text
idempotent
recoverable
tested
```

Không assume service worker luôn chạy xuyên suốt migration.

---

# 44. Error Handling

User-facing error categories:

```text
Could not find AI input.

This skill is missing required values.

Shortcut already exists.

Skill could not be saved.

Skill Vault does not support this AI yet.
```

Không expose raw stack traces cho user.

Internal development logging:

```text
[SkillVault][Adapter]
[SkillVault][Slash]
[SkillVault][Storage]
```

Production logs minimal.

---

# 45. MVP Screens

Chỉ cần 5 màn hình chính:

```text
1. Vault Library
2. Skill Editor
3. Command Palette
4. Variable Form
5. Settings
```

Onboarding rất nhỏ:

```text
Save skills.
Type /skill inside your AI chat.
Choose one and insert it.
```

---

# 46. Settings

MVP:

```text
Enable ChatGPT
Enable Claude
Enable Gemini

Show favorites first
Enable direct shortcuts

Privacy information

Export
Import
```

Potential later:

```text
Theme
Command trigger
Generic websites
Cloud Sync
```

---

# 47. Product State Machine

```text
Extension Installed
       │
       ▼
Initialize Storage
       │
       ▼
Create Context Menu
       │
       ▼
User visits AI
       │
       ▼
Detect Provider
       │
       ▼
Detect Composer
       │
       ▼
READY
       │
       ├── /skill → Palette
       │
       ├── right click → Save Skill
       │
       └── side panel → Manage Vault
```

---

# 48. MVP Sequence — `/skill`

```text
User
 │
 │ types /skill
 ▼
Content Script
 │
 │ detect command
 ▼
Slash Engine
 │
 │ SKILL_SEARCH("")
 ▼
Service Worker
 │
 ▼
Skill Repository
 │
 │ results
 ▼
Content Script
 │
 ▼
Command Palette
 │
 │ user selects
 ▼
Prompt Renderer
 │
 ▼
AI Adapter
 │
 │ insert text
 ▼
AI Composer
```

---

# 49. MVP Sequence — Save Highlight

```text
Webpage
 │
 │ selection
 ▼
Context Menu
 │
 │ Save selection as Skill
 ▼
Service Worker
 │
 │ create draft
 ▼
Side Panel
 │
 ▼
Skill Editor
 │
 │ Save
 ▼
Repository
```

---

# 50. Recommended Technology Stack

Build tooling:

```text
TypeScript
React
Vite
```

Extension framework:

Option A:

```text
Plain Chrome MV3 + Vite
```

Option B:

```text
Plasmo
```

Option C:

```text
WXT
```

Architecture không nên phụ thuộc framework.

Domain, adapters và rendering engine phải là plain TypeScript càng nhiều càng tốt.

---

# 51. Recommended MVP Technical Choice

Tôi ưu tiên:

```text
TypeScript
React for Side Panel
Plain TypeScript for content runtime
Vite
Chrome MV3
Shadow DOM
Vitest
Playwright
```

Không cần state framework như Redux ở MVP.

UI state có thể dùng:

```text
React state
+
small stores
```

Domain state nằm trong repository.

---

# 52. Important Architectural Principle

Tách:

```text
Skill Engine
```

khỏi:

```text
Browser Extension Layer
```

Core package:

```text
packages/core
```

bao gồm:

```text
Skill model
Validation
Search
Variable parser
Prompt renderer
```

Extension:

```text
apps/browser-extension
```

Sau này core có thể dùng lại cho:

```text
desktop
CLI
VS Code
web app
mobile
```

---

# 53. Future Monorepo Architecture

```text
skill-vault/
│
├── apps/
│   ├── extension/
│   └── web/
│
├── packages/
│   ├── core/
│   ├── adapters/
│   ├── storage/
│   ├── ui/
│   └── skill-format/
│
└── tooling/
```

MVP vẫn có thể bắt đầu một repo đơn để tránh overengineering.

---

# 54. Feature Flags

Adapter website dễ hỏng.

Có local feature flags:

```ts
interface FeatureFlags {
  chatgpt: boolean;
  claude: boolean;
  gemini: boolean;
  genericAdapter: boolean;
  directShortcut: boolean;
}
```

Giúp disable chức năng lỗi nhanh mà không phá toàn extension.

---

# 55. Version 0.1 Scope

Ship:

```text
Skill CRUD
Search
Favorites
Tags

Right-click Save Selection

ChatGPT Adapter
Claude Adapter
Gemini Adapter

/skill command

Command Palette

Insert skill

JSON Import/Export

Local storage
```

Không ship:

```text
variables
direct /shortcut
sync
marketplace
backend
accounts
```

Nếu muốn MVP cực gọn, variables đưa sang 0.2.

---

# 56. Version 0.2

Add:

```text
{{selected_text}}
{{page_title}}
{{page_url}}

custom variables

/review
/rewrite

recent skills

generic adapter
```

---

# 57. Version 0.3

Add:

```text
Markdown export
SKILL.md
folders
skill packs
provider overrides
```

---

# 58. Version 1.0

Mục tiêu UX:

```text
Save skill anywhere.
Press / inside any supported AI.
Find it instantly.
Insert it safely.
```

Quality bar:

```text
<100 ms perceived palette response

zero lost composer content

zero automatic message sends

stable across supported AI providers

local-first by default
```

---

# 59. Future Backend Boundary

Khi cần sync, không thay đổi core architecture.

Add:

```text
SyncEngine
   │
   ├── Local Repository
   │
   └── Remote Repository
```

Remote model:

```text
user
vault
skill
revision
device
```

Sync design:

```text
local-first
optimistic
revision based
conflict detection
```

Backend không nên trở thành requirement để `/skill` hoạt động.

Offline luôn phải dùng được.

---

# 60. Product North Star

Skill Vault không nên phát triển thành một collection app quá nặng.

Core interaction phải luôn giữ:

```text
TYPE
  /
FIND
  skill
INSERT
  ↵
```

Nếu một feature làm flow này chậm hơn, cần cân nhắc loại bỏ.

---

# 61. Architectural North Star

```text
┌──────── Skill Vault Core ────────┐
│                                  │
│ Skills                           │
│ Search                           │
│ Variables                        │
│ Renderer                         │
│                                  │
└────────────────┬─────────────────┘
                 │
        ┌────────▼────────┐
        │ Browser Runtime │
        └────────┬────────┘
                 │
       ┌─────────▼──────────┐
       │ Adapter Registry   │
       └─────────┬──────────┘
                 │
     ┌───────────┼────────────┐
     ▼           ▼            ▼
 ChatGPT       Claude       Gemini
```

Website-specific code phải bị cô lập ở adapters.

Đây là nguyên tắc kỹ thuật quan trọng nhất của Skill Vault.

---

# 62. Definition of Done — MVP

MVP được xem là hoàn thành khi:

```text
✓ User tạo được skill.

✓ Skill vẫn còn sau browser restart.

✓ User bôi đen text trên web và lưu thành skill.

✓ User mở ChatGPT và gõ /skill.

✓ Palette hiện mà không phá UI ChatGPT.

✓ User tìm skill bằng keyboard.

✓ Enter chèn skill đúng vị trí.

✓ Extension không tự send message.

✓ Claude hoạt động cùng behavior.

✓ Gemini hoạt động cùng behavior.

✓ Website thay composer/remount vẫn recover.

✓ Không mất text user đã gõ.

✓ Không có conversation data gửi ra network.

✓ Import/export backup hoạt động.
```

---

# 63. Architectural Decisions Summary

**ADR-001**

```text
Local-first architecture.
```

Reason:

```text
privacy
speed
offline
MVP simplicity
```

**ADR-002**

```text
No backend in MVP.
```

**ADR-003**

```text
Manifest V3 service worker.
```

**ADR-004**

```text
Side Panel = management UI.
```

**ADR-005**

```text
Injected Shadow DOM = command UI.
```

**ADR-006**

```text
Provider-specific adapter architecture.
```

**ADR-007**

```text
No automatic send.
```

**ADR-008**

```text
Core Skill Engine independent from browser.
```

**ADR-009**

```text
Skills stored locally; sync reserved for lightweight settings initially.
```

**ADR-010**

```text
Website is untrusted; prompt is always treated as plain text data.
```

---

# 64. Final Product Architecture

```text
                       SKILL VAULT

                    ┌───────────────┐
                    │  Skill Core   │
                    │               │
                    │ Model         │
                    │ Search        │
                    │ Variables     │
                    │ Renderer      │
                    └───────┬───────┘
                            │
             ┌──────────────┼──────────────┐
             │              │              │
             ▼              ▼              ▼

      ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
      │ Side Panel  │ │ Slash Engine│ │ Context Menu│
      │             │ │             │ │             │
      │ Library     │ │ /skill      │ │ Save Skill  │
      │ Editor      │ │ Palette     │ │             │
      └──────┬──────┘ └──────┬──────┘ └──────┬──────┘
             │               │               │
             └───────────────┼───────────────┘
                             │
                             ▼
                  ┌─────────────────────┐
                  │ Service Worker      │
                  │                     │
                  │ Repository          │
                  │ Messaging           │
                  │ Settings            │
                  │ Migration           │
                  └──────────┬──────────┘
                             │
                             ▼
                   ┌─────────────────┐
                   │ chrome.storage  │
                   └─────────────────┘


                 WEB INTEGRATION LAYER

                  ┌─────────────────┐
                  │ Adapter Registry│
                  └────────┬────────┘
                           │
             ┌─────────────┼──────────────┐
             │             │              │
             ▼             ▼              ▼
         ChatGPT         Claude         Gemini
             │             │              │
             └─────────────┼──────────────┘
                           │
                           ▼
                    AI Chat Composer
```

**Bản kiến trúc này đủ nhỏ để build MVP nhưng không khóa Skill Vault vào một prompt manager đơn giản.**

Nó để sẵn đường phát triển từ:

```text
Prompt Vault
    ↓
Skill Launcher
    ↓
Universal AI Command Layer
    ↓
AI Workflow Platform
```

mà không cần viết lại kiến trúc cốt lõi.
