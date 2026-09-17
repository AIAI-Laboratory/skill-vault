import { isValidShortcut, RESERVED_SHORTCUTS } from './skill';

export type DetectedFormat =
  'prompt' | 'code' | 'error_log' | 'sql' | 'json' | 'shell' | 'tabular' | 'url' | 'text';

export type DetectedCodeLanguage =
  | 'typescript'
  | 'javascript'
  | 'python'
  | 'html'
  | 'css'
  | 'sql'
  | 'bash'
  | 'go'
  | 'rust'
  | 'java'
  | 'cpp'
  | 'generic';

export interface PreprocessedContent {
  originalText: string;
  cleanedText: string;
  lineCount: number;
  wordCount: number;
  hasCodeFence: boolean;
  codeFenceLang?: string;
  strippedLineNumbers: boolean;
  commonIndentationRemoved: number;
  detectedLanguageHint?: DetectedCodeLanguage;
}

export interface DetectedFormatInfo {
  format: DetectedFormat;
  formatLabel: string;
  confidence: number;
  codeLanguage?: DetectedCodeLanguage;
  details?: string;
  roleHint?: string;
  skillMetadata?: { name: string; description: string };
}

export interface TemplateOption {
  id: string;
  label: string;
  name: string;
  shortcut: string;
  description: string;
  content: string;
  tags: string[];
  isPrimary?: boolean;
}

export interface DetectionResult {
  preprocessed: PreprocessedContent;
  formatInfo: DetectedFormatInfo;
  primaryTemplate: TemplateOption;
  templates: TemplateOption[];
}

export interface DraftSkill {
  rawContent?: string;
  content: string;
  url?: string;
  title?: string;
  timestamp?: number;
  detectedFormat?: DetectedFormat;
  formatLabel?: string;
  suggestedName?: string;
  suggestedShortcut?: string;
  suggestedDescription?: string;
  suggestedTags?: string[];
  templateOptions?: TemplateOption[];
  activeTemplateId?: string;
}

/**
 * 1. PRE-PROCESS PHASE
 * Cleans, unescapes, normalizes, dedents, strips line numbers, and extracts structural hints.
 */
export function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

export function stripLineNumbers(lines: string[]): { lines: string[]; stripped: boolean } {
  if (lines.length === 0) return { lines, stripped: false };

  // Common patterns for line numbers:
  // "1 | code", "1: code", "1  code", "[1] code"
  const lineNumPattern = /^\s*(?:\[\d+\]|\d+\s*[|:]\s?|\d+\s{2,})/;
  const nonEmptyLines = lines.filter((l) => l.trim().length > 0);

  if (nonEmptyLines.length === 0) return { lines, stripped: false };

  const matchCount = nonEmptyLines.filter((l) => lineNumPattern.test(l)).length;
  const ratio = matchCount / nonEmptyLines.length;

  if (ratio >= 0.7 && matchCount >= 2) {
    const strippedLines = lines.map((l) => l.replace(lineNumPattern, ''));
    return { lines: strippedLines, stripped: true };
  }

  return { lines, stripped: false };
}

export function dedent(lines: string[]): { lines: string[]; commonIndent: number } {
  const nonEmpty = lines.filter((l) => l.trim().length > 0);
  if (nonEmpty.length === 0) return { lines, commonIndent: 0 };

  let minIndent = Infinity;
  for (const line of nonEmpty) {
    const match = line.match(/^(\s*)/);
    const indent = match ? match[1].length : 0;
    if (indent < minIndent) {
      minIndent = indent;
    }
  }

  if (minIndent > 0 && minIndent !== Infinity) {
    const dedented = lines.map((line) => (line.trim().length > 0 ? line.slice(minIndent) : ''));
    return { lines: dedented, commonIndent: minIndent };
  }

  return { lines, commonIndent: 0 };
}

export function preprocessContent(rawText: string): PreprocessedContent {
  const originalText = rawText || '';
  let text = originalText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Decode HTML entities
  text = decodeHtmlEntities(text);

  let hasCodeFence = false;
  let codeFenceLang: string | undefined;

  // Check if content is entirely enclosed in markdown code fences: ```[lang]\n...\n```
  const fenceRegex = /^\s*```([a-zA-Z0-9_-]*)\n([\s\S]*?)\n```\s*$/;
  const fenceMatch = text.match(fenceRegex);
  if (fenceMatch) {
    hasCodeFence = true;
    codeFenceLang = fenceMatch[1].trim().toLowerCase() || undefined;
    text = fenceMatch[2];
  }

  // Split into lines for structural cleanup
  let lines = text.split('\n');

  // Strip blockquote prefixes if almost all lines have >
  const nonEmptyLines = lines.filter((l) => l.trim().length > 0);
  if (nonEmptyLines.length > 0) {
    const quoteCount = nonEmptyLines.filter((l) => /^\s*>\s?/.test(l)).length;
    if (quoteCount / nonEmptyLines.length >= 0.8) {
      lines = lines.map((l) => l.replace(/^\s*>\s?/, ''));
    }
  }

  // Strip uniform line numbers (e.g. from GitHub, blogs, IDEs)
  const lineNumResult = stripLineNumbers(lines);
  lines = lineNumResult.lines;

  // Remove common indentation (dedent)
  const dedentResult = dedent(lines);
  lines = dedentResult.lines;

  // Trim trailing whitespace from each line
  lines = lines.map((l) => l.trimEnd());

  // Reassemble and normalize consecutive blank lines (max 2)
  text = lines
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  const finalLines = text.split('\n');
  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;

  // Derive language hint from code fence if any
  let detectedLanguageHint: DetectedCodeLanguage | undefined;
  if (codeFenceLang) {
    detectedLanguageHint = normalizeCodeLanguage(codeFenceLang);
  }

  return {
    originalText,
    cleanedText: text,
    lineCount: finalLines.length,
    wordCount,
    hasCodeFence,
    codeFenceLang,
    strippedLineNumbers: lineNumResult.stripped,
    commonIndentationRemoved: dedentResult.commonIndent,
    detectedLanguageHint,
  };
}

function normalizeCodeLanguage(lang: string): DetectedCodeLanguage {
  const l = lang.toLowerCase();
  if (['ts', 'typescript', 'tsx'].includes(l)) return 'typescript';
  if (['js', 'javascript', 'jsx', 'mjs', 'cjs'].includes(l)) return 'javascript';
  if (['py', 'python', 'py3'].includes(l)) return 'python';
  if (['html', 'htm', 'xml', 'svg'].includes(l)) return 'html';
  if (['css', 'scss', 'sass', 'less'].includes(l)) return 'css';
  if (['sql', 'mysql', 'pgsql', 'postgres', 'sqlite'].includes(l)) return 'sql';
  if (['sh', 'bash', 'zsh', 'shell'].includes(l)) return 'bash';
  if (['go', 'golang'].includes(l)) return 'go';
  if (['rs', 'rust'].includes(l)) return 'rust';
  if (['java', 'kotlin', 'cs', 'csharp'].includes(l)) return 'java';
  if (['c', 'cpp', 'cxx', 'cc', 'h', 'hpp'].includes(l)) return 'cpp';
  return 'generic';
}

function readMetadataScalar(value: string): string {
  if (value.startsWith('"') && value.endsWith('"')) {
    try {
      return JSON.parse(value) as string;
    } catch {
      return value.slice(1, -1);
    }
  }
  if (value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1).replace(/''/g, "'");
  }
  return value.replace(/\s+#.*$/, '').trim();
}

// Context-menu selections can flatten the rendered GitHub code lines into spaces.
// Recover metadata only inside a closed leading frontmatter block; never rewrite
// the selection or infer fields from the document body.
function readCollapsedSkillMetadata(text: string): DetectedFormatInfo['skillMetadata'] {
  const frontmatter = text.match(/^---\s+([\s\S]*?)\s+---(?=\s|$)/);
  if (!frontmatter) return undefined;

  const fieldPattern =
    /(?:^|\s)(name|description):\s+("(?:\\.|[^"\\])*"|'(?:''|[^'])*'|[\s\S]*?)(?=\s+(?:name|description|license|compatibility|metadata|allowed-tools|argument-hint|disable-model-invocation|user-invocable):(?:\s|$)|$)/g;
  const fields: Record<string, string> = {};
  for (const match of frontmatter[1].matchAll(fieldPattern)) {
    const value = match[2].trim().replace(/^[>|][-+]?\s+/, '');
    fields[match[1]] = readMetadataScalar(value);
  }
  return fields.name && fields.description
    ? { name: fields.name, description: fields.description }
    : undefined;
}

// Read only the display fields we need; leave the source document untouched.
// This intentionally does not interpret YAML objects, tags, or aliases.
function readSkillMetadata(text: string): DetectedFormatInfo['skillMetadata'] {
  const frontmatter = text.match(/^---\s*\n([\s\S]*?)\n---[ \t]*(?:\n|$)/);
  if (!frontmatter) return readCollapsedSkillMetadata(text);

  const lines = frontmatter[1].split('\n');
  const readField = (key: string): string => {
    const index = lines.findIndex((line) => line.startsWith(`${key}:`));
    if (index < 0) return '';
    const value = lines[index].slice(key.length + 1).trim();
    if (/^[>|][-+]?\s*$/.test(value)) {
      const continuation: string[] = [];
      for (let i = index + 1; i < lines.length; i++) {
        if (lines[i].trim() && !/^\s/.test(lines[i])) break;
        continuation.push(lines[i].trim());
      }
      return continuation.join(value.startsWith('>') ? ' ' : '\n').trim();
    }
    return readMetadataScalar(value);
  };

  const name = readField('name');
  const description = readField('description');
  return name && description ? { name, description } : readCollapsedSkillMetadata(text);
}

/**
 * 2. FORMAT DETECTION PHASE
 * Analyzes pre-processed content to accurately classify its format.
 */
export function detectFormat(preprocessed: PreprocessedContent): DetectedFormatInfo {
  const text = preprocessed.cleanedText;
  if (!text) {
    return {
      format: 'text',
      formatLabel: 'Text / Empty',
      confidence: 1,
    };
  }

  // Skill documents can contain SQL, code, and stack traces as examples.
  // Their frontmatter takes precedence over heuristics for those examples.
  const skillMetadata = readSkillMetadata(text);
  if (skillMetadata) {
    return {
      format: 'prompt',
      formatLabel: 'Skill Markdown',
      confidence: 0.99,
      skillMetadata,
      details: 'Skill instructions with name and description frontmatter',
    };
  }

  // --- A. Detect Error Log / Stack Trace ---
  const stackTracePatterns = [
    /(?:^|\n)\s*at\s+(?:[a-zA-Z0-9_$<>.]+\s*\(|.+:\d+:\d+\)?)/,
    /Traceback \(most recent call last\):/i,
    /File\s+["'][^"']+["'],\s+line\s+\d+/i,
    /(?:^|\n)\s*(?:panic|fatal error):/i,
    /\b(?:TypeError|ReferenceError|SyntaxError|RangeError|URIError|EvalError|NullPointerException|ArrayIndexOutOfBoundsException|ClassNotFoundException|KeyError|ValueError|AttributeError|ZeroDivisionError|SQLException|FatalErrorException|UnhandledPromiseRejection)\b/,
    /(?:Exception|Error|Failure):\s+[^\n]+/,
    /\bStatus(?:\s*code)?:\s*(?:4\d\d|5\d\d)\b/i,
    /\bHTTP\s+(?:4\d\d|5\d\d)\b/i,
  ];
  let errorMatches = 0;
  for (const pat of stackTracePatterns) {
    if (pat.test(text)) errorMatches++;
  }
  if (
    errorMatches >= 2 ||
    /Traceback \(most recent call last\):/i.test(text) ||
    /(?:^|\n)\s*at\s+[a-zA-Z0-9_$<>.]+\s*\(/.test(text)
  ) {
    return {
      format: 'error_log',
      formatLabel: 'Error Log / Stack Trace',
      confidence: 0.95,
      details: 'Detected runtime exception or error stack trace',
    };
  }

  // --- B. Detect AI Prompt / System Instruction ---
  const promptRoleMatch = text.match(
    /^(?:you are an?|act as an?|i want you to act as an?|bạn là một?|hãy đóng vai|đóng vai)\s+([^.\n]+)/i
  );
  const promptDirectiveMatch =
    /^(?:system:|prompt:|role:|instructions:|guidelines:|context:|vai trò:|hướng dẫn:|mục tiêu:)/im.test(
      text
    );
  const promptImperativeMatch =
    /^(?:your task is to|please act as|as a [a-z0-9_-]+, you will|your mission is|nhiệm vụ của bạn là|hãy viết|hãy tạo|hãy tóm tắt|hãy phân tích|hãy giải thích)\b/i.test(
      text
    );
  const hasVariablePlaceholder =
    /\{\{\s*(?:selected_text|current_date|page_title|page_url|input|text)\s*\}\}/.test(text);

  if (
    promptRoleMatch ||
    promptDirectiveMatch ||
    (promptImperativeMatch && preprocessed.wordCount > 8) ||
    hasVariablePlaceholder
  ) {
    const roleHint = promptRoleMatch ? promptRoleMatch[1].trim() : undefined;
    return {
      format: 'prompt',
      formatLabel: 'AI Prompt / System Instruction',
      confidence: 0.92,
      roleHint,
      details: roleHint ? `Role: ${roleHint}` : 'Structured AI instructions detected',
    };
  }

  // --- C. Detect JSON ---
  const trimmed = text.trim();
  if (
    (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
    (trimmed.startsWith('[') && trimmed.endsWith(']'))
  ) {
    try {
      JSON.parse(trimmed);
      return {
        format: 'json',
        formatLabel: 'JSON Data',
        confidence: 0.98,
        details: 'Valid JSON object or array payload',
      };
    } catch {
      // Relaxed check if slightly truncated
      if (/^\s*\{\s*"[^"]+"\s*:\s*/.test(trimmed)) {
        return {
          format: 'json',
          formatLabel: 'JSON Data',
          confidence: 0.8,
          details: 'JSON-like data structure',
        };
      }
    }
  }

  // --- D. Detect SQL ---
  const sqlKeywordsRegex =
    /^\s*(?:WITH\s+(?:RECURSIVE\s+)?[a-zA-Z0-9_]+\s+AS\s*\(|SELECT\s+[^;]+?\s+FROM\b|INSERT\s+INTO\s+|UPDATE\s+[a-zA-Z0-9_.]+\s+SET\b|DELETE\s+FROM\b|CREATE\s+TABLE\b|ALTER\s+TABLE\b|DROP\s+TABLE\b)/i;
  if (preprocessed.detectedLanguageHint === 'sql' || sqlKeywordsRegex.test(text)) {
    return {
      format: 'sql',
      formatLabel: 'SQL Query',
      confidence: 0.9,
      codeLanguage: 'sql',
      details: 'Structured SQL database query',
    };
  }

  // --- E. Detect Programming Code ---
  const codeLang = preprocessed.detectedLanguageHint || detectCodeLanguageFromText(text);
  if (codeLang) {
    const labelMap: Record<DetectedCodeLanguage, string> = {
      typescript: 'TypeScript Code',
      javascript: 'JavaScript Code',
      python: 'Python Code',
      html: 'HTML / Web Component',
      css: 'CSS Styles',
      sql: 'SQL Query',
      bash: 'Shell Script',
      go: 'Go (Golang) Code',
      rust: 'Rust Code',
      java: 'Java / C# Code',
      cpp: 'C / C++ Code',
      generic: 'Source Code',
    };
    return {
      format: 'code',
      formatLabel: labelMap[codeLang] || 'Code Snippet',
      codeLanguage: codeLang,
      confidence: 0.85,
      details: `Detected ${codeLang} programming code`,
    };
  }

  // --- F. Detect Shell / Bash ---
  const isShellScript =
    /^\s*#!\/(?:usr\/)?bin\/(?:bash|sh|zsh)/.test(text) ||
    /^\s*(?:sudo|chmod|chown|curl|wget|git|npm|pnpm|yarn|bun|docker|docker-compose|kubectl|npx|brew|apt-get|systemctl)\s+/m.test(
      text
    ) ||
    /^\s*export\s+[A-Z_][A-Z0-9_]*=/m.test(text) ||
    /^\s*\$\s+[a-z0-9_-]+/m.test(text);

  if (isShellScript && preprocessed.lineCount <= 30) {
    return {
      format: 'shell',
      formatLabel: 'Shell / Bash Command',
      confidence: 0.88,
      codeLanguage: 'bash',
      details: 'CLI command or shell script',
    };
  }

  // --- G. Detect Tabular Data (Markdown Table or CSV) ---
  const lines = text.split('\n').filter((l) => l.trim().length > 0);
  const isMarkdownTable =
    lines.length >= 2 &&
    lines.filter((l) => l.includes('|')).length >= 2 &&
    lines.some((l) => /\|?\s*:?-+:?\s*\|/.test(l));

  if (isMarkdownTable) {
    return {
      format: 'tabular',
      formatLabel: 'Markdown Table',
      confidence: 0.95,
      details: 'Tabular dataset in Markdown format',
    };
  }

  // CSV detection: >= 3 lines, uniform comma count >= 2
  if (lines.length >= 3) {
    const commaCounts = lines.map((l) => (l.match(/,/g) || []).length);
    if (commaCounts[0] >= 2 && commaCounts.every((c) => c === commaCounts[0])) {
      return {
        format: 'tabular',
        formatLabel: 'CSV Data Table',
        confidence: 0.9,
        details: 'Comma-separated tabular data',
      };
    }
  }

  // --- H. Detect URL ---
  if (/^https?:\/\/[^\s]+$/.test(trimmed)) {
    return {
      format: 'url',
      formatLabel: 'Web URL',
      confidence: 0.99,
      details: 'Direct web link',
    };
  }

  // --- I. Default / Text Prose ---
  const isVietnamese =
    /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(text);
  return {
    format: 'text',
    formatLabel: isVietnamese ? 'Văn bản / Bài viết' : 'Text / Article Content',
    confidence: 0.7,
    details: isVietnamese ? 'Nội dung văn bản tiếng Việt' : 'General text or article excerpt',
  };
}

function detectCodeLanguageFromText(text: string): DetectedCodeLanguage | undefined {
  // Score heuristics
  let tsScore = 0;
  let pyScore = 0;
  let htmlScore = 0;
  let cssScore = 0;
  let goScore = 0;
  let rustScore = 0;
  let javaScore = 0;
  let cppScore = 0;

  // TypeScript / JavaScript
  if (
    /\b(?:import\s+.*from|export\s+(?:default\s+)?(?:const|let|var|function|class|interface|type))\b/.test(
      text
    )
  )
    tsScore += 3;
  if (/\b(?:const|let|var)\s+[a-zA-Z0-9_$]+\s*=/.test(text)) tsScore += 2;
  if (/\b(?:interface|type)\s+[A-Z][a-zA-Z0-9_]*\s*(?:=|\{)/.test(text)) tsScore += 3;
  if (/=>\s*\{?/.test(text)) tsScore += 1;
  if (/\b(?:console\.log|useState|useEffect|async\s+function)\b/.test(text)) tsScore += 2;

  // Python
  if (/\bdef\s+[a-zA-Z0-9_]+\s*\(.*?\)(?:\s*->\s*[^:]+)?\s*:/.test(text)) pyScore += 4;
  if (/\bclass\s+[a-zA-Z0-9_]+(?:\(.*?\))?\s*:/.test(text)) pyScore += 3;
  if (/\b(?:import\s+[a-zA-Z0-9_]+|from\s+[a-zA-Z0-9_.]+\s+import)\b/.test(text)) pyScore += 2;
  if (/\b(?:self\.[a-zA-Z0-9_]+|__init__|__name__\s*==\s*['"]__main__['"])\b/.test(text))
    pyScore += 3;
  if (/\belif\s+.*:/.test(text)) pyScore += 3;
  if (/\breturn\b/.test(text) && /\bdef\b/.test(text)) pyScore += 2;
  if (/\b(?:import\s+[a-zA-Z0-9_]+|from\s+[a-zA-Z0-9_.]+\s+import)\b/.test(text)) pyScore += 2;
  if (/\b(?:self\.[a-zA-Z0-9_]+|__init__|__name__\s*==\s*['"]__main__['"])\b/.test(text))
    pyScore += 3;
  if (/\belif\s+.*:/.test(text)) pyScore += 3;

  // HTML / XML
  if (/^<(!DOCTYPE|html|div|span|p|a|table|svg|form|template|section)[\s>]/i.test(text))
    htmlScore += 4;
  if (/<\/(?:div|span|p|html|body|table|form)>/i.test(text)) htmlScore += 3;

  // CSS
  if (/[.#a-zA-Z0-9_:-]+\s*\{\s*[\w-]+:\s*[^;]+;\s*\}/m.test(text)) cssScore += 4;
  if (/@(?:media|keyframes|import)\b/.test(text)) cssScore += 3;

  // Go
  if (/\bpackage\s+[a-z0-9_]+/.test(text)) goScore += 4;
  if (/\bfunc\s+(?:\([a-zA-Z0-9_* ]+\)\s*)?[a-zA-Z0-9_]+\s*\(/.test(text)) goScore += 4;
  if (/\btype\s+[a-zA-Z0-9_]+\s+struct\b/.test(text)) goScore += 3;

  // Rust
  if (/\bfn\s+[a-zA-Z0-9_]+\s*\(/.test(text)) rustScore += 3;
  if (/\b(?:pub\s+fn|let\s+mut|impl\s+[a-zA-Z0-9_]+|use\s+std::)\b/.test(text)) rustScore += 4;

  // Java / C#
  if (
    /\b(?:public\s+class|private\s+void|public\s+static\s+void\s+main|System\.out\.println)\b/.test(
      text
    )
  )
    javaScore += 4;

  // C / C++
  if (/\b(?:#include\s*<[a-zA-Z0-9_.]+>|std::cout|std::vector|int\s+main\s*\(\))\b/.test(text))
    cppScore += 4;

  const scores = [
    { lang: 'typescript' as DetectedCodeLanguage, score: tsScore },
    { lang: 'python' as DetectedCodeLanguage, score: pyScore },
    { lang: 'html' as DetectedCodeLanguage, score: htmlScore },
    { lang: 'css' as DetectedCodeLanguage, score: cssScore },
    { lang: 'go' as DetectedCodeLanguage, score: goScore },
    { lang: 'rust' as DetectedCodeLanguage, score: rustScore },
    { lang: 'java' as DetectedCodeLanguage, score: javaScore },
    { lang: 'cpp' as DetectedCodeLanguage, score: cppScore },
  ];

  scores.sort((a, b) => b.score - a.score);
  if (scores[0].score >= 2) {
    return scores[0].lang;
  }

  // Generic code check: has multiple semicolons, braces, or typical code punctuation
  const hasBraces = /\{[\s\S]*\}/.test(text);
  const hasSemicolons = (text.match(/;/g) || []).length >= 2;
  if (hasBraces || hasSemicolons) {
    return 'generic';
  }

  return undefined;
}

/**
 * 3. TEMPLATE DETECTION & GENERATION PHASE
 * Maps detected format & pre-processed content to complete, high-quality skill templates.
 */
export function slugify(text: string, maxLen = 20): string {
  let slug = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip Vietnamese diacritics
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, maxLen)
    .replace(/-+$/, '');

  if (!slug) slug = 'skill';
  if (RESERVED_SHORTCUTS.has(slug)) slug = `${slug}-prompt`;
  return slug;
}

export function detectTemplate(
  preprocessed: PreprocessedContent,
  formatInfo: DetectedFormatInfo,
  meta?: { url?: string; title?: string }
): DetectionResult {
  const { format, codeLanguage, roleHint, skillMetadata } = formatInfo;
  const text = preprocessed.cleanedText;

  const templates: TemplateOption[] = [];

  // ==========================================
  // FORMAT: PROMPT / SYSTEM INSTRUCTION
  // ==========================================
  if (format === 'prompt') {
    let skillName = 'Custom AI Skill';
    let shortcut = 'prompt';
    let desc = 'Reusable AI instruction and prompt skill';

    if (skillMetadata) {
      skillName = skillMetadata.name;
      shortcut = slugify(skillName, 32);
      desc = skillMetadata.description;
    } else if (roleHint) {
      const cleanRole = roleHint
        .replace(/[,.:].*$/, '')
        .trim()
        .replace(/\b\w/g, (c) => c.toUpperCase());
      skillName = cleanRole;
      shortcut = slugify(cleanRole, 16);
      desc = `Act as ${cleanRole} to perform specialized tasks`;
    } else {
      // derive name from first line
      const firstLine = text
        .split('\n')[0]
        .replace(/^[#>*\s-]+/, '')
        .trim();
      if (firstLine.length > 3 && firstLine.length <= 40) {
        skillName = firstLine.replace(/\b\w/g, (c) => c.toUpperCase());
        shortcut = slugify(firstLine, 16);
      }
    }

    // Template 1: The prompt as-is (clean)
    templates.push({
      id: 'prompt_direct',
      label: 'Direct Prompt',
      name: skillName,
      shortcut: isValidShortcut(shortcut).valid ? shortcut : 'custom-prompt',
      description: desc,
      content: skillMetadata ? preprocessed.originalText : text,
      tags: ['prompt', 'custom', 'ai'],
      isPrimary: true,
    });

    // Template 2: Prompt with appended {{selected_text}} input block
    const withInput = text.includes('{{selected_text}}')
      ? text
      : `${text}\n\nInput:\n{{selected_text}}`;

    templates.push({
      id: 'prompt_with_input',
      label: 'With Input Variable',
      name: `${skillName} (Input)`,
      shortcut: slugify(`${shortcut}-in`, 18),
      description: `${desc} applied to selected text`,
      content: withInput,
      tags: ['prompt', 'workflow', 'variable'],
    });

    // Template 3: Prompt Optimizer / Refiner
    templates.push({
      id: 'prompt_refiner',
      label: 'Prompt Optimizer',
      name: 'Optimize & Enhance Prompt',
      shortcut: 'opt-prompt',
      description: 'Analyze, expand, and structure prompts for maximum AI output quality',
      content: `You are a Principal Prompt Engineer. Optimize the following prompt to maximize clarity, eliminate ambiguities, and elicit the highest-quality response from state-of-the-art LLMs.

Please provide:
1. Analysis of strengths and potential failure modes
2. Optimized Prompt (with clear Role, Context, Constraints, and Output Format)
3. 2-3 recommended test cases or variations

Prompt to optimize:
{{selected_text}}`,
      tags: ['prompt-engineering', 'meta', 'optimization'],
    });
  }

  // ==========================================
  // FORMAT: ERROR LOG / STACK TRACE
  // ==========================================
  else if (format === 'error_log') {
    templates.push({
      id: 'error_debug',
      label: 'Bug Investigator (Fix & RCA)',
      name: 'Debug Error / Stack Trace',
      shortcut: 'debug',
      description:
        'Root cause analysis, reproduction, and immediate code fix for errors and stack traces',
      content: `You are an expert systems debugger. Help me diagnose and fix the following error.

Please provide:
1. Root Cause Analysis: Explain exactly what triggered this failure and why.
2. Immediate Fix: Provide the exact code diff or configuration update.
3. Defensive Safeguards: Unit tests or architectural safeguards to prevent recurrence.

Error / Logs:
{{selected_text}}`,
      tags: ['debug', 'error', 'troubleshooting'],
      isPrimary: true,
    });

    templates.push({
      id: 'error_explain',
      label: 'Explain Error (ELI5)',
      name: 'Explain Error Simply',
      shortcut: 'explain-error',
      description: 'Explain errors and solutions in clear, beginner-friendly language',
      content: `Explain the following error message in simple, intuitive terms:
1. What is going wrong?
2. Why did this error occur?
3. How to fix it in 2-3 simple steps?

Error:
{{selected_text}}`,
      tags: ['debug', 'learning', 'help'],
    });

    templates.push({
      id: 'error_raw',
      label: 'Raw Error Snippet',
      name: 'Error Report',
      shortcut: 'err-report',
      description: 'Raw error and stack trace saved for reference',
      content: `Analyze the following error:\n\n${text}`,
      tags: ['debug', 'snippet'],
    });
  }

  // ==========================================
  // FORMAT: CODE (SPECIFIC LANGUAGES)
  // ==========================================
  else if (format === 'code') {
    const lang = codeLanguage || 'generic';

    if (lang === 'typescript' || lang === 'javascript') {
      templates.push({
        id: 'ts_review',
        label: 'Code Review & Refactor',
        name: 'TypeScript Code Review',
        shortcut: 'ts-review',
        description: 'Senior TypeScript review for type safety, edge cases, and performance',
        content: `You are a Principal TypeScript / React Engineer. Conduct a rigorous code review of the following snippet.

Analyze for:
1. Correctness, null/undefined safety, and edge cases
2. Strict type safety and interface design (avoid any/unknown without guards)
3. Performance, re-render avoidance, and memory leaks
4. Idiomatic modern TypeScript patterns and readability

Provide concrete code diffs or refactored code for suggested improvements.

Code to review:
{{selected_text}}`,
        tags: ['coding', 'typescript', 'review'],
        isPrimary: true,
      });

      templates.push({
        id: 'ts_explain',
        label: 'Explain TypeScript Code',
        name: 'Explain TypeScript Code',
        shortcut: 'ts-explain',
        description: 'Break down TypeScript code logic and architecture step-by-step',
        content: `Explain the following TypeScript code clearly:
1. High-level purpose and core flow
2. Key types, functions, and language features used
3. Potential edge cases or caveats to be aware of

Code:
{{selected_text}}`,
        tags: ['coding', 'typescript', 'learning'],
      });

      templates.push({
        id: 'ts_test',
        label: 'Generate Unit Tests (Vitest)',
        name: 'TypeScript Tests (Vitest)',
        shortcut: 'ts-test',
        description: 'Generate comprehensive Vitest / Jest unit tests with edge cases and mocks',
        content: `You are a Senior TypeScript QA and Test Automation Specialist.
Write comprehensive unit tests for the following code using Vitest / Jest.

Include:
1. Happy path test cases
2. Edge cases (null/undefined, boundary numbers, empty arrays)
3. Error path and exception testing

Code under test:
{{selected_text}}`,
        tags: ['coding', 'typescript', 'testing'],
      });

      templates.push({
        id: 'code_snippet',
        label: 'Raw Code Snippet',
        name: 'TypeScript Snippet',
        shortcut: 'ts-snippet',
        description: 'Saved TypeScript reference snippet',
        content: `// Reusable TypeScript snippet:\n${text}`,
        tags: ['coding', 'typescript', 'snippet'],
      });
    } else if (lang === 'python') {
      templates.push({
        id: 'py_review',
        label: 'Python Code Review',
        name: 'Python Code Review',
        shortcut: 'py-review',
        description: 'Senior Python review for PEP 8, algorithmic complexity, and edge cases',
        content: `You are a Principal Python Engineer. Conduct a thorough review of the following Python code.

Analyze for:
1. Correctness, edge cases, and exception handling
2. Performance, algorithmic complexity, and memory management
3. Pythonic idioms, type hints, and PEP 8 best practices

Provide concrete code improvements with clean diffs.

Python code:
{{selected_text}}`,
        tags: ['coding', 'python', 'review'],
        isPrimary: true,
      });

      templates.push({
        id: 'py_explain',
        label: 'Explain Python Code',
        name: 'Explain Python Code',
        shortcut: 'py-explain',
        description: 'Step-by-step explanation of Python code logic and algorithms',
        content: `Explain the following Python code intuitively:
1. What does this code do and why?
2. Step-by-step walkthrough of logic and variables
3. Built-in Python features or libraries utilized

Python code:
{{selected_text}}`,
        tags: ['coding', 'python', 'learning'],
      });

      templates.push({
        id: 'py_test',
        label: 'Generate pytest Tests',
        name: 'Python Unit Tests (pytest)',
        shortcut: 'py-test',
        description: 'Generate pytest unit tests with parametrization and fixtures',
        content: `Write comprehensive unit tests using pytest for the following Python code.
Include parametrization, boundary tests, and mock fixtures where appropriate.

Code to test:
{{selected_text}}`,
        tags: ['coding', 'python', 'testing'],
      });

      templates.push({
        id: 'code_snippet',
        label: 'Raw Python Snippet',
        name: 'Python Snippet',
        shortcut: 'py-snippet',
        description: 'Saved Python reference snippet',
        content: `# Reusable Python snippet:\n${text}`,
        tags: ['coding', 'python', 'snippet'],
      });
    } else if (lang === 'html' || lang === 'css') {
      templates.push({
        id: 'ui_review',
        label: 'UI & Accessibility Review',
        name: 'Frontend UI Component Review',
        shortcut: 'ui-review',
        description:
          'Review UI markup for accessibility (a11y), responsiveness, and CSS architecture',
        content: `You are a Principal Frontend Architect. Review the following UI markup / styles.

Evaluate for:
1. Semantic HTML and WCAG accessibility standards (ARIA, color contrast, focus states)
2. Responsive layout flexibility across mobile and desktop
3. Modern CSS best practices (custom properties, container queries, minimal specificity)

Provide refactored code and explanations.

Markup / CSS:
{{selected_text}}`,
        tags: ['frontend', 'html', 'css', 'a11y'],
        isPrimary: true,
      });

      templates.push({
        id: 'ui_convert',
        label: 'Convert to Tailwind CSS',
        name: 'Convert UI to Tailwind',
        shortcut: 'tailwind',
        description: 'Convert raw HTML/CSS into modern Tailwind CSS components',
        content: `Convert the following HTML/CSS component into a responsive, clean component using Tailwind CSS v3/v4.

Source UI:
{{selected_text}}`,
        tags: ['frontend', 'tailwind', 'css'],
      });
    } else if (lang === 'go') {
      templates.push({
        id: 'go_review',
        label: 'Go Code Review',
        name: 'Go (Golang) Code Review',
        shortcut: 'go-review',
        description: 'Senior Golang review for goroutines, channel safety, and idiomatic patterns',
        content: `You are a Principal Go Engineer. Review the following Go code for:
1. Idiomatic Go conventions and error handling
2. Concurrency safety (goroutine leaks, race conditions, mutex locking)
3. Memory allocation and performance

Provide concrete Go code improvements.

Go code:
{{selected_text}}`,
        tags: ['coding', 'go', 'golang', 'review'],
        isPrimary: true,
      });
    } else if (lang === 'rust') {
      templates.push({
        id: 'rust_review',
        label: 'Rust Code Review',
        name: 'Rust Code Review',
        shortcut: 'rs-review',
        description:
          'Senior Rust review for ownership, lifetimes, safety, and zero-cost abstractions',
        content: `You are a Senior Rust Engineer. Review the following Rust code for:
1. Idiomatic Rust, error handling (Result/Option), and match patterns
2. Ownership, borrowing, lifetimes, and unnecessary clones
3. Safe concurrency and performance

Provide refactored code and explanations.

Rust code:
{{selected_text}}`,
        tags: ['coding', 'rust', 'engineering'],
        isPrimary: true,
      });
    } else {
      // Generic Code fallback
      templates.push({
        id: 'code_review',
        label: 'Code Review & Refactor',
        name: 'Code Review & Refactor',
        shortcut: 'code-review',
        description:
          'Rigorous code review for correctness, security, performance, and maintainability',
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
        isPrimary: true,
      });

      templates.push({
        id: 'code_explain',
        label: 'Explain Code Simply',
        name: 'Explain Code Simply',
        shortcut: 'code-explain',
        description: 'Explain code logic clearly with ELI5 clarity and intuitive metaphors',
        content: `Explain the following code in simple, intuitive terms:
1. What is the core mechanism and purpose?
2. Step-by-step walkthrough of how data flows through it
3. Potential edge cases or gotchas

Code:
{{selected_text}}`,
        tags: ['coding', 'learning'],
      });

      templates.push({
        id: 'code_snippet',
        label: 'Raw Snippet',
        name: 'Saved Code Snippet',
        shortcut: 'snippet',
        description: 'Raw code snippet saved for reference',
        content: text,
        tags: ['coding', 'snippet'],
      });
    }
  }

  // ==========================================
  // FORMAT: SQL QUERY
  // ==========================================
  else if (format === 'sql') {
    templates.push({
      id: 'sql_opt',
      label: 'SQL Query Optimizer',
      name: 'SQL Query Optimizer',
      shortcut: 'sql-opt',
      description: 'Optimize SQL queries for execution performance, index usage, and readability',
      content: `You are a Principal Database Administrator and SQL Performance Specialist.
Analyze and optimize the following SQL query.

Please provide:
1. Bottleneck analysis (full table scans, cartesian joins, unindexed filters)
2. Optimized SQL query
3. Recommended indexes or schema tweaks
4. Expected execution plan improvements

SQL Query:
{{selected_text}}`,
      tags: ['sql', 'database', 'optimization'],
      isPrimary: true,
    });

    templates.push({
      id: 'sql_explain',
      label: 'Explain SQL Query',
      name: 'Explain SQL Query',
      shortcut: 'sql-explain',
      description: 'Explain SQL query operations, joins, and data flow in plain English',
      content: `Explain what the following SQL query does in plain language:
1. Data sources and how tables are joined
2. Filtering, grouping, and aggregation logic
3. Expected output format and meaning

SQL:
{{selected_text}}`,
      tags: ['sql', 'database', 'learning'],
    });

    templates.push({
      id: 'sql_raw',
      label: 'Raw SQL Query',
      name: 'Saved SQL Query',
      shortcut: 'sql-query',
      description: 'Saved SQL query reference',
      content: text,
      tags: ['sql', 'snippet'],
    });
  }

  // ==========================================
  // FORMAT: JSON DATA
  // ==========================================
  else if (format === 'json') {
    templates.push({
      id: 'json_types',
      label: 'JSON to TypeScript & Zod',
      name: 'JSON to TypeScript & Schema',
      shortcut: 'json-types',
      description: 'Generate TypeScript interfaces and Zod validation schema from JSON',
      content: `You are a TypeScript and API design expert. Analyze the following JSON data:

1. Generate complete, idiomatic TypeScript interfaces/types (handling optional/nullable fields).
2. Generate a matching Zod schema for runtime validation.
3. Note any schema inconsistencies or potential data modeling improvements.

JSON Data:
{{selected_text}}`,
      tags: ['json', 'typescript', 'types', 'schema'],
      isPrimary: true,
    });

    templates.push({
      id: 'json_analyze',
      label: 'Analyze JSON Data',
      name: 'Analyze JSON Data Structure',
      shortcut: 'json-analyze',
      description: 'Analyze data hierarchy, key relationships, and data quality issues',
      content: `Analyze the structure and contents of this JSON payload:
1. Schema summary and key entities
2. Data quality checks (missing fields, unexpected types, anomalies)
3. Suggestions for transformation or normalization

JSON:
{{selected_text}}`,
      tags: ['json', 'data', 'analysis'],
    });

    templates.push({
      id: 'json_raw',
      label: 'Raw JSON Payload',
      name: 'Saved JSON Data',
      shortcut: 'json-data',
      description: 'Saved JSON reference payload',
      content: text,
      tags: ['json', 'data'],
    });
  }

  // ==========================================
  // FORMAT: SHELL / BASH
  // ==========================================
  else if (format === 'shell') {
    templates.push({
      id: 'bash_help',
      label: 'Shell Command Explainer & Hardener',
      name: 'Bash & CLI Explainer',
      shortcut: 'bash-help',
      description: 'Explain shell commands, flag breakdown, and recommend safe robust practices',
      content: `Analyze the following shell commands / script:

1. Detailed breakdown of every command, option flag, argument, and pipe
2. Identify potential destructive operations, permission requirements, or portability issues
3. Provide a robust, production-ready version (with set -euo pipefail, error traps, quote escaping)

Script:
{{selected_text}}`,
      tags: ['bash', 'cli', 'devops', 'terminal'],
      isPrimary: true,
    });

    templates.push({
      id: 'bash_raw',
      label: 'Raw Shell Script',
      name: 'Saved Shell Script',
      shortcut: 'sh-script',
      description: 'Saved shell script command',
      content: text,
      tags: ['bash', 'script'],
    });
  }

  // ==========================================
  // FORMAT: TABULAR (MARKDOWN TABLE / CSV)
  // ==========================================
  else if (format === 'tabular') {
    templates.push({
      id: 'table_analyze',
      label: 'Tabular Data Analyst',
      name: 'Data Table Analysis',
      shortcut: 'table-data',
      description: 'Analyze data tables, identify patterns, summary statistics, and trends',
      content: `You are a Senior Data Analyst. Analyze the following tabular data:

1. Overview: Dimensions, field types, and summary statistics.
2. Key Insights: Patterns, outliers, correlations, or anomalies in the dataset.
3. 3-5 Strategic Recommendations based on the observations.

Data:
{{selected_text}}`,
      tags: ['data', 'table', 'analysis'],
      isPrimary: true,
    });

    templates.push({
      id: 'table_to_json',
      label: 'Convert Table to JSON',
      name: 'Convert Table to JSON',
      shortcut: 'table-to-json',
      description: 'Convert markdown table or CSV dataset into clean JSON array',
      content: `Convert the following tabular data into a clean, well-formatted JSON array of objects with proper types (numbers, booleans, strings).

Table:
{{selected_text}}`,
      tags: ['data', 'converter', 'json'],
    });
  }

  // ==========================================
  // FORMAT: GENERAL TEXT / PROSE / ARTICLE
  // ==========================================
  else {
    const isVietnamese =
      /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(text);

    if (isVietnamese) {
      templates.push({
        id: 'vi_summary',
        label: 'Tóm tắt & Ý chính',
        name: 'Tóm tắt & Ý chính',
        shortcut: 'tom-tat',
        description: 'Tóm tắt văn bản thành các luận điểm chính và hành động cần thiết',
        content: `Hãy tóm tắt đoạn văn bản sau một cách rõ ràng, súc tích và dễ hiểu:

1. Tóm tắt tổng quan (2-3 câu ngắn gọn)
2. Các luận điểm & ý chính quan trọng nhất (dạng gạch đầu dòng)
3. Bài học rút ra hoặc hành động tiếp theo

Văn bản:
{{selected_text}}`,
        tags: ['tom-tat', 'nang-suat', 'viet-van'],
        isPrimary: true,
      });

      templates.push({
        id: 'vi_rewrite',
        label: 'Viết lại chuyên nghiệp',
        name: 'Viết lại chuyên nghiệp',
        shortcut: 'viet-lai',
        description: 'Chỉnh sửa văn phong chuyên nghiệp, súc tích và hấp dẫn',
        content: `Hãy viết lại đoạn văn bản sau sao cho trau chuốt, chuyên nghiệp, súc tích và mạch lạc hơn. Giữ nguyên ý chính nhưng loại bỏ từ ngữ rườm rà.

Đoạn văn:
{{selected_text}}`,
        tags: ['viet-van', 'chuyen-nghiep'],
      });

      templates.push({
        id: 'vi_translate',
        label: 'Dịch sang tiếng Anh',
        name: 'Dịch sang tiếng Anh tự nhiên',
        shortcut: 'dich-anh',
        description: 'Dịch văn bản sang tiếng Anh chuẩn xác, tự nhiên theo ngữ cảnh',
        content: `Translate the following Vietnamese text into natural, fluent, idiomatic English. Maintain professional tone and context accuracy.

Text:
{{selected_text}}`,
        tags: ['dich-thuat', 'tieng-anh'],
      });

      templates.push({
        id: 'text_raw',
        label: 'Văn bản gốc',
        name: 'Đoạn văn bản trích dẫn',
        shortcut: 'van-ban',
        description: 'Lưu đoạn trích dẫn nguyên gốc',
        content: text,
        tags: ['trich-dan'],
      });
    } else {
      templates.push({
        id: 'en_summary',
        label: 'Summarize & Key Takeaways',
        name: 'Summarize & Key Takeaways',
        shortcut: 'summarize',
        description: 'Executive summary, core arguments, and actionable takeaways',
        content: `Analyze and summarize the following text:

1. Executive Summary: High-level overview in 2-3 concise sentences.
2. Key Takeaways: Core arguments and supporting points in bullet points.
3. Action Items / Implications: What to do or remember next.

Text:
{{selected_text}}`,
        tags: ['summary', 'productivity', 'reading'],
        isPrimary: true,
      });

      templates.push({
        id: 'en_rewrite',
        label: 'Professional Rewrite',
        name: 'Professional Rewrite',
        shortcut: 'rewrite',
        description: 'Refine draft writing into clear, authoritative, and concise prose',
        content: `Rewrite the following draft text to be polished, professional, concise, and impactful.

Guidelines:
- Eliminate filler words and passive voice
- Maintain an authoritative yet collaborative tone
- Enhance clarity and paragraph transitions

Draft:
{{selected_text}}`,
        tags: ['writing', 'productivity', 'email'],
      });

      templates.push({
        id: 'en_explain',
        label: 'Explain Simply (ELI5)',
        name: 'Explain Concept Simply',
        shortcut: 'explain',
        description: 'Explain complex concepts with intuitive metaphors and simple clarity',
        content: `Explain the following topic in simple, intuitive terms as if explaining to a curious high school student:
- A memorable real-world analogy
- Why it matters
- The core mechanism broken into 2-3 simple steps

Topic:
{{selected_text}}`,
        tags: ['learning', 'concept'],
      });

      templates.push({
        id: 'text_raw',
        label: 'Raw Text Snippet',
        name: meta?.title ? `Snippet: ${meta.title.slice(0, 30)}` : 'Saved Text Snippet',
        shortcut: 'text-snippet',
        description: 'Saved reference text excerpt',
        content: text,
        tags: ['snippet', 'notes'],
      });
    }
  }

  // Ensure at least one template exists
  if (templates.length === 0) {
    templates.push({
      id: 'fallback_template',
      label: 'Standard Prompt',
      name: 'Custom Skill',
      shortcut: 'custom',
      description: 'Custom prompt template',
      content: text,
      tags: ['custom'],
      isPrimary: true,
    });
  }

  const primaryTemplate = templates.find((t) => t.isPrimary) || templates[0];

  return {
    preprocessed,
    formatInfo,
    primaryTemplate,
    templates,
  };
}

/**
 * 4. END-TO-END PIPELINE
 * Given raw highlighted/selected text, performs:
 * Pre-process -> Detect Format -> Detect Template -> Returns complete result.
 */
export function processAndDetect(
  rawText: string,
  meta?: { url?: string; title?: string }
): DetectionResult {
  const preprocessed = preprocessContent(rawText);
  const formatInfo = detectFormat(preprocessed);
  const result = detectTemplate(preprocessed, formatInfo, meta);
  return result;
}
