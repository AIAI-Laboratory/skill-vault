// Native Selection/Range behavior needs a real browser, not a simulated DOM.
// Run with: CHROME_BIN=/path/to/chrome node scripts/verify-selection.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import ts from 'typescript';

function checkSelections(readSelection, window) {
  const { document } = window;
  const results = [];
  const check = (name, actual, expected) => {
    results.push({ name, passed: actual === expected, actual, expected });
  };
  const select = (node) => {
    const range = document.createRange();
    range.selectNodeContents(node);
    window.getSelection().removeAllRanges();
    window.getSelection().addRange(range);
    return range;
  };
  const source =
    '---\nname: codebase-replication\ndescription: Learn conventions.\n---\n\n# Instructions\n\n    indented line\n\ttabbed line';
  const pre = document.createElement('pre');
  pre.textContent = source;
  document.body.append(pre);
  select(pre);
  check('preformatted text', readSelection(), source);

  for (const className of ['react-file-line', 'blob-code-inner']) {
    const container = document.createElement(className === 'blob-code-inner' ? 'table' : 'div');
    const rows = source.split('\n').map((text) => {
      const line = document.createElement(className === 'blob-code-inner' ? 'td' : 'div');
      line.className = className;
      line.style.whiteSpace = 'pre';
      line.style.height = '20px';
      line.textContent = text;
      if (className === 'blob-code-inner') {
        const row = document.createElement('tr');
        row.append(line);
        container.append(row);
      } else {
        container.append(line);
      }
      return line;
    });
    document.body.append(container);
    select(container);
    check(`${className}: blank lines and indentation`, readSelection(), source);

    const range = select(container);
    range.setStart(rows[1].firstChild, 6);
    range.setEnd(rows[7].firstChild, 12);
    const selectedLines = source.split('\n').slice(1, 8);
    selectedLines[0] = selectedLines[0].slice(6);
    selectedLines[6] = selectedLines[6].slice(0, 12);
    check(`${className}: partial first and last lines`, readSelection(), selectedLines.join('\n'));

    const singleLine = select(rows[7]);
    singleLine.setStart(rows[7].firstChild, 4);
    singleLine.setEnd(rows[7].firstChild, 12);
    check(`${className}: single line fragment`, readSelection(), 'indented');
  }

  const textarea = document.createElement('textarea');
  textarea.value = 'before\n    selected\n\n\tafter';
  document.body.append(textarea);
  textarea.focus();
  textarea.setSelectionRange(7, textarea.value.length);
  check('textarea selection', readSelection(), textarea.value.slice(7));

  textarea.blur();
  window.getSelection().removeAllRanges();
  check('empty selection', readSelection(), '');
  const output = document.createElement('pre');
  output.id = 'selection-results';
  output.textContent = JSON.stringify(results);
  document.body.replaceChildren(output);
}

const browser =
  process.env.CHROME_BIN || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-vault-selection-'));
try {
  const source = fs.readFileSync(new URL('../src/content/selection.ts', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source.replace('export function', 'function'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const fixture = path.join(directory, 'selection.html');
  fs.writeFileSync(
    fixture,
    `<!doctype html><meta charset="utf-8"><body><script>${compiled}\n(${checkSelections.toString()})(readPageSelection, window);</script>`
  );
  const result = spawnSync(
    browser,
    [
      '--headless',
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-background-networking',
      '--disable-component-update',
      '--disable-sync',
      '--password-store=basic',
      '--use-mock-keychain',
      '--dump-dom',
      `--user-data-dir=${directory}/profile`,
      `file://${fixture}`,
    ],
    { encoding: 'utf8', timeout: 15000, maxBuffer: 4 * 1024 * 1024 }
  );
  const output = result.stdout?.match(/<pre id="selection-results">([\s\S]*?)<\/pre>/);
  if (!output) throw result.error || new Error(result.stderr || 'Browser produced no results');
  const results = JSON.parse(
    output[1].replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
  );
  for (const check of results) {
    console.log(`${check.passed ? 'PASS' : 'FAIL'} ${check.name}`);
    if (!check.passed) console.error(JSON.stringify(check));
  }
  if (results.some((check) => !check.passed)) process.exitCode = 1;
} finally {
  fs.rmSync(directory, { recursive: true, force: true });
}
