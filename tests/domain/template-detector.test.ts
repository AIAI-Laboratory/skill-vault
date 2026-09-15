import { describe, it, expect } from 'vitest';
import {
  decodeHtmlEntities,
  stripLineNumbers,
  dedent,
  preprocessContent,
  detectFormat,
  detectTemplate,
  processAndDetect,
  slugify,
} from '../../src/domain/template-detector';

describe('template-detector', () => {
  describe('Pre-processing (preprocessContent)', () => {
    it('decodes HTML entities properly', () => {
      const input =
        '&lt;div class=&quot;box&quot;&gt;&amp; &lt;b&gt;&#39;hello&#39;&lt;/b&gt;&lt;/div&gt;';
      const decoded = decodeHtmlEntities(input);
      expect(decoded).toBe('<div class="box">& <b>\'hello\'</b></div>');
    });

    it('strips uniform leading line numbers', () => {
      const lines = [' 1 | function add(a, b) {', ' 2 |   return a + b;', ' 3 | }'];
      const result = stripLineNumbers(lines);
      expect(result.stripped).toBe(true);
      expect(result.lines).toEqual(['function add(a, b) {', '  return a + b;', '}']);
    });

    it('does not strip text if line numbers are sporadic or non-uniform', () => {
      const lines = ['1 | function add(a, b) {', 'Just some normal text', 'Another normal line'];
      const result = stripLineNumbers(lines);
      expect(result.stripped).toBe(false);
    });

    it('dedents common leading indentation', () => {
      const lines = ['    const x = 1;', '    const y = 2;', '    return x + y;'];
      const result = dedent(lines);
      expect(result.commonIndent).toBe(4);
      expect(result.lines).toEqual(['const x = 1;', 'const y = 2;', 'return x + y;']);
    });

    it('unwraps fenced markdown code blocks and extracts language', () => {
      const raw = '```python\ndef calculate(n):\n    return n * 2\n```';
      const preprocessed = preprocessContent(raw);
      expect(preprocessed.hasCodeFence).toBe(true);
      expect(preprocessed.codeFenceLang).toBe('python');
      expect(preprocessed.detectedLanguageHint).toBe('python');
      expect(preprocessed.cleanedText).toBe('def calculate(n):\n    return n * 2');
    });

    it('strips blockquotes when entire selection is quoted', () => {
      const raw = '> You are a Senior Copywriter.\n> Rewrite this text to be engaging.';
      const preprocessed = preprocessContent(raw);
      expect(preprocessed.cleanedText).toBe(
        'You are a Senior Copywriter.\nRewrite this text to be engaging.'
      );
    });

    it('collapses excessive blank lines and trims whitespace', () => {
      const raw = '   Line 1\n\n\n\n\nLine 2   \n\n';
      const preprocessed = preprocessContent(raw);
      expect(preprocessed.cleanedText).toBe('Line 1\n\nLine 2');
    });
  });

  describe('Format Detection (detectFormat)', () => {
    it('detects AI prompt in English starting with "You are a..."', () => {
      const text =
        'You are a Principal Software Architect. Review this system design for scalability and fault tolerance.';
      const pre = preprocessContent(text);
      const formatInfo = detectFormat(pre);
      expect(formatInfo.format).toBe('prompt');
      expect(formatInfo.roleHint).toBe('Principal Software Architect');
    });

    it('detects AI prompt in Vietnamese starting with "Bạn là một..."', () => {
      const text =
        'Bạn là một chuyên gia marketing xuất sắc. Hãy viết bài đăng Facebook quảng bá sản phẩm mới.';
      const pre = preprocessContent(text);
      const formatInfo = detectFormat(pre);
      expect(formatInfo.format).toBe('prompt');
      expect(formatInfo.roleHint).toBe('chuyên gia marketing xuất sắc');
    });

    it('detects Error Log with stack trace', () => {
      const text = `TypeError: Cannot read properties of undefined (reading 'map')
    at UserList (http://localhost:3000/src/components/UserList.tsx:24:18)
    at renderWithHooks (http://localhost:3000/node_modules/react-dom/cjs/react-dom.development.js:15486:18)`;
      const pre = preprocessContent(text);
      const formatInfo = detectFormat(pre);
      expect(formatInfo.format).toBe('error_log');
      expect(formatInfo.formatLabel).toBe('Error Log / Stack Trace');
    });

    it('detects Python Traceback', () => {
      const text = `Traceback (most recent call last):
  File "main.py", line 12, in <module>
    process_data()
KeyError: 'user_id'`;
      const pre = preprocessContent(text);
      const formatInfo = detectFormat(pre);
      expect(formatInfo.format).toBe('error_log');
    });

    it('detects valid JSON object', () => {
      const text = '{\n  "name": "Skill Vault",\n  "version": 1,\n  "enabled": true\n}';
      const pre = preprocessContent(text);
      const formatInfo = detectFormat(pre);
      expect(formatInfo.format).toBe('json');
      expect(formatInfo.formatLabel).toBe('JSON Data');
    });

    it('detects valid JSON array', () => {
      const text = '[{"id": 1, "title": "First"}, {"id": 2, "title": "Second"}]';
      const pre = preprocessContent(text);
      const formatInfo = detectFormat(pre);
      expect(formatInfo.format).toBe('json');
    });

    it('detects SQL query', () => {
      const text = `SELECT u.id, u.email, COUNT(o.id) as order_count
FROM users u
LEFT JOIN orders o ON u.id = o.user_id
WHERE u.created_at >= '2026-01-01'
GROUP BY u.id, u.email
HAVING order_count > 5
ORDER BY order_count DESC;`;
      const pre = preprocessContent(text);
      const formatInfo = detectFormat(pre);
      expect(formatInfo.format).toBe('sql');
      expect(formatInfo.formatLabel).toBe('SQL Query');
    });

    it('detects Python code', () => {
      const text = `def fibonacci(n: int) -> int:
    if n <= 1:
        return n
    return fibonacci(n - 1) + fibonacci(n - 2)`;
      const pre = preprocessContent(text);
      const formatInfo = detectFormat(pre);
      expect(formatInfo.format).toBe('code');
      expect(formatInfo.codeLanguage).toBe('python');
    });

    it('detects TypeScript / React code', () => {
      const text = `import React, { useState } from 'react';

interface Props {
  initialCount?: number;
}

export const Counter: React.FC<Props> = ({ initialCount = 0 }) => {
  const [count, setCount] = useState(initialCount);
  return <button onClick={() => setCount(count + 1)}>{count}</button>;
};`;
      const pre = preprocessContent(text);
      const formatInfo = detectFormat(pre);
      expect(formatInfo.format).toBe('code');
      expect(formatInfo.codeLanguage).toBe('typescript');
    });

    it('detects Shell / Bash command', () => {
      const text = `#!/bin/bash
set -euo pipefail

docker build -t my-app:latest .
docker run -d -p 8080:8080 my-app:latest`;
      const pre = preprocessContent(text);
      const formatInfo = detectFormat(pre);
      expect(formatInfo.format).toBe('shell');
      expect(formatInfo.formatLabel).toBe('Shell / Bash Command');
    });

    it('detects Markdown table', () => {
      const text = `| Feature | Status | Priority |
|---|---|---|
| Auto-detect format | Done | High |
| Template generator | Done | High |`;
      const pre = preprocessContent(text);
      const formatInfo = detectFormat(pre);
      expect(formatInfo.format).toBe('tabular');
      expect(formatInfo.formatLabel).toBe('Markdown Table');
    });

    it('detects Vietnamese article / text', () => {
      const text =
        'Hệ thống lưu trữ kỹ năng AI giúp lập trình viên và người dùng tiết kiệm thời gian tái sử dụng các câu lệnh prompt hiệu quả.';
      const pre = preprocessContent(text);
      const formatInfo = detectFormat(pre);
      expect(formatInfo.format).toBe('text');
      expect(formatInfo.formatLabel).toBe('Văn bản / Bài viết');
    });
  });

  describe('Template Generation & Auto-fill (detectTemplate & processAndDetect)', () => {
    it('generates prompt template for AI role prompt', () => {
      const raw =
        'You are a Senior Security Architect specializing in OAuth 2.0. Review this authentication flow.';
      const pre = preprocessContent(raw);
      const fmt = detectFormat(pre);
      const result = detectTemplate(pre, fmt, { title: 'Auth Architecture' });
      expect(result.formatInfo.format).toBe('prompt');
      expect(result.primaryTemplate.name).toContain('Security Architect');
      expect(result.primaryTemplate.content).toBe(raw);
      expect(result.primaryTemplate.shortcut).toBeTruthy();
      expect(result.templates.length).toBeGreaterThanOrEqual(2);
    });

    it('generates bug investigation template for stack trace', () => {
      const raw = `TypeError: undefined is not a function
    at eval (app.js:10:15)
    at run (app.js:20:5)`;
      const result = processAndDetect(raw);
      expect(result.formatInfo.format).toBe('error_log');
      expect(result.primaryTemplate.name).toBe('Debug Error / Stack Trace');
      expect(result.primaryTemplate.shortcut).toBe('debug');
      expect(result.primaryTemplate.content).toContain('{{selected_text}}');
      expect(result.primaryTemplate.tags).toContain('debug');
    });

    it('generates Python code review template for Python code', () => {
      const raw =
        '```python\ndef fetch_users(db, query):\n    results = db.execute(query)\n    return [dict(row) for row in results]\n```';
      const result = processAndDetect(raw);
      expect(result.formatInfo.format).toBe('code');
      expect(result.formatInfo.codeLanguage).toBe('python');
      expect(result.primaryTemplate.name).toBe('Python Code Review');
      expect(result.primaryTemplate.shortcut).toBe('py-review');
      expect(result.primaryTemplate.content).toContain('{{selected_text}}');
      expect(result.templates.some((t) => t.id === 'py_test')).toBe(true);
    });

    it('generates SQL optimizer template for SQL queries', () => {
      const raw = 'SELECT * FROM products WHERE category = 5 AND active = 1 ORDER BY price;';
      const result = processAndDetect(raw);
      expect(result.formatInfo.format).toBe('sql');
      expect(result.primaryTemplate.name).toBe('SQL Query Optimizer');
      expect(result.primaryTemplate.shortcut).toBe('sql-opt');
      expect(result.primaryTemplate.content).toContain('{{selected_text}}');
    });

    it('generates TypeScript and Zod schema template for JSON data', () => {
      const raw = '{\n  "userId": 100,\n  "role": "admin",\n  "active": true\n}';
      const result = processAndDetect(raw);
      expect(result.formatInfo.format).toBe('json');
      expect(result.primaryTemplate.name).toBe('JSON to TypeScript & Schema');
      expect(result.primaryTemplate.shortcut).toBe('json-types');
      expect(result.primaryTemplate.tags).toContain('typescript');
    });

    it('generates Vietnamese summary template for Vietnamese prose', () => {
      const raw = 'Trí tuệ nhân tạo đang thay đổi cách chúng ta lập trình và làm việc hàng ngày.';
      const result = processAndDetect(raw);
      expect(result.formatInfo.format).toBe('text');
      expect(result.primaryTemplate.name).toBe('Tóm tắt & Ý chính');
      expect(result.primaryTemplate.shortcut).toBe('tom-tat');
    });
  });

  describe('slugify', () => {
    it('removes diacritics and special characters', () => {
      expect(slugify('Tóm tắt & Ý chính')).toBe('tom-tat-y-chinh');
      expect(slugify('Python Code Review')).toBe('python-code-review');
    });

    it('avoids reserved shortcuts', () => {
      expect(slugify('skill')).toBe('skill-prompt');
      expect(slugify('vault')).toBe('vault-prompt');
    });
  });
});
