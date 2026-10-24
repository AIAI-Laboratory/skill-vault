import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { selectStoreRelease } from './store-release.mjs';

const release = (tag, overrides = {}) => ({
  tag_name: tag,
  draft: false,
  prerelease: false,
  published_at: '2026-10-25T00:00:00Z',
  assets: [{ name: `skill-vault-${tag}.zip`, state: 'uploaded', size: 100 }],
  ...overrides,
});
const dirs = [];
afterEach(() => dirs.splice(0).forEach((dir) => fs.rmSync(dir, { recursive: true, force: true })));
const sandbox = () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-vault-cd-'));
  dirs.push(dir);
  return dir;
};
const installFakeGh = (dir) => {
  const gh = path.join(dir, 'gh');
  fs.writeFileSync(
    gh,
    `#!${process.execPath}
import fs from 'node:fs';
const args = process.argv.slice(2);
fs.appendFileSync(process.env.CALLS, JSON.stringify(args) + String.fromCharCode(10));
if (args[0] === 'api') {
  console.log(process.env.PAGES);
} else if (args[1] === 'view') {
  if (process.env.ABSENT === 'true') process.exit(1);
  console.log(process.env.RELEASE);
}
`
  );
  fs.chmodSync(gh, 0o755);
};
const workflowStep = (name) => {
  const source = fs.readFileSync(
    new URL('../.github/workflows/release.yml', import.meta.url),
    'utf8'
  );
  const section = source.split(`      - name: ${name}\n`)[1].split('\n      - name: ')[0];
  return section
    .split('        run: |\n')[1]
    .split('\n')
    .map((line) => (line.startsWith('          ') ? line.slice(10) : line))
    .join('\n');
};

describe('select Store release independently of GitHub latest flags', () => {
  it('ignores beta accidentally published as stable/latest', () => {
    expect(selectStoreRelease([release('v0.1.4-beta'), release('v0.1.4')]).tag).toBe('v0.1.4');
  });
  it('ignores numeric drafts and prereleases', () => {
    expect(
      selectStoreRelease([
        release('v0.1.6', { draft: true }),
        release('v0.1.5', { prerelease: true }),
        release('v0.1.4'),
      ]).tag
    ).toBe('v0.1.4');
  });
  it('chooses the highest numeric version, even on older API pages', () => {
    expect(selectStoreRelease([release('v0.1.9'), release('v0.1.10'), release('v0.1.8')]).tag).toBe(
      'v0.1.10'
    );
  });
  it.each(['main', 'v01.2.3', 'v0.0.0', 'v1.2.65536', 'v1.2.3+build'])(
    'ignores unsupported tag %s',
    (tag) => {
      expect(selectStoreRelease([release(tag)]).state).toBe('empty');
    }
  );
  it('waits for the newest stable ZIP without falling back to an older package', () => {
    const result = selectStoreRelease([release('v0.1.5', { assets: [] }), release('v0.1.4')]);
    expect(result.state).toBe('waiting');
    expect(result.tag).toBeUndefined();
    expect(result.message).toContain('v0.1.5');
  });
  it.each([
    { state: 'new', size: 100 },
    { state: 'uploaded', size: 0 },
  ])('waits for incomplete or empty assets (%j)', (asset) => {
    expect(
      selectStoreRelease([
        release('v0.1.4', { assets: [{ name: 'skill-vault-v0.1.4.zip', ...asset }] }),
      ]).state
    ).toBe('waiting');
  });
  it('reads paginated releases and writes only the validated candidate to Actions outputs', () => {
    const dir = sandbox();
    installFakeGh(dir);
    const result = spawnSync(
      process.execPath,
      [new URL('store-release.mjs', import.meta.url).pathname],
      {
        env: {
          ...process.env,
          PATH: `${dir}:${process.env.PATH}`,
          GH_REPO: 'owner/repo',
          CALLS: path.join(dir, 'calls'),
          PAGES: JSON.stringify([[release('v0.1.4-beta')], [release('v0.1.4')]]),
          GITHUB_OUTPUT: path.join(dir, 'output'),
          GITHUB_ENV: path.join(dir, 'env'),
          GITHUB_STEP_SUMMARY: path.join(dir, 'summary'),
        },
        encoding: 'utf8',
      }
    );
    expect(result.status, result.stderr).toBe(0);
    expect(fs.readFileSync(path.join(dir, 'output'), 'utf8')).toBe('tag=v0.1.4\n');
    expect(fs.readFileSync(path.join(dir, 'env'), 'utf8')).toBe('RELEASE_VERSION=v0.1.4\n');
    const [args] = fs
      .readFileSync(path.join(dir, 'calls'), 'utf8')
      .trim()
      .split('\n')
      .map(JSON.parse);
    expect(args).toContain('--paginate');
    expect(args).toContain('--slurp');
  });
});

describe('release preparation shell from the actual workflow', () => {
  const runPrepare = (metadata, absent = false) => {
    const dir = sandbox();
    installFakeGh(dir);
    const result = spawnSync('bash', ['-e', '-c', workflowStep('Prepare GitHub Release')], {
      cwd: dir,
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: `${dir}:${process.env.PATH}`,
        RELEASE_TAG: 'v0.1.4',
        GITHUB_SHA: 'exact-tag-commit',
        RELEASE: JSON.stringify(metadata),
        ABSENT: String(absent),
        CALLS: path.join(dir, 'calls'),
      },
    });
    const calls = fs
      .readFileSync(path.join(dir, 'calls'), 'utf8')
      .trim()
      .split('\n')
      .map(JSON.parse);
    return { result, calls };
  };
  it('creates a draft with both ZIPs when no release exists', () => {
    const { result, calls } = runPrepare({}, true);
    expect(result.status, result.stderr).toBe(0);
    const create = calls.find((args) => args[1] === 'create');
    expect(create).toContain('--draft');
    expect(create).toContain('exact-tag-commit');
    expect(create).toContain('skill-vault-v0.1.4.zip');
    expect(create).toContain('skill-vault.zip');
  });
  it('updates an existing draft before publication', () => {
    const { result, calls } = runPrepare({ isDraft: true, assets: [] });
    expect(result.status, result.stderr).toBe(0);
    expect(calls.find((args) => args[1] === 'upload')).toContain('--clobber');
  });
  it('fills ZIPs when the user publishes before the build completes', () => {
    const { result, calls } = runPrepare({ isDraft: false, assets: [] });
    expect(result.status, result.stderr).toBe(0);
    const upload = calls.find((args) => args[1] === 'upload');
    expect(upload).toContain('skill-vault-v0.1.4.zip');
    expect(upload).not.toContain('--clobber');
  });
  it('preserves both existing published assets on duplicate triggers and reruns', () => {
    const { result, calls } = runPrepare({
      isDraft: false,
      assets: [{ name: 'skill-vault-v0.1.4.zip' }, { name: 'skill-vault.zip' }],
    });
    expect(result.status, result.stderr).toBe(0);
    expect(calls.some((args) => args[1] === 'upload')).toBe(false);
  });
  it('fails clearly on a partially published ZIP pair instead of replacing bytes', () => {
    const { result, calls } = runPrepare({
      isDraft: false,
      assets: [{ name: 'skill-vault-v0.1.4.zip' }],
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('only one ZIP asset');
    expect(calls.some((args) => args[1] === 'upload')).toBe(false);
  });
  it.each(['v0.1.4-beta', 'v1.2.3-rc.1', 'v1.2.3+build', 'vgarbage'])(
    'skips build and package for unsupported tag %s',
    (tag) => {
      const dir = sandbox();
      const result = spawnSync('bash', ['-e', '-c', workflowStep('Select release tag')], {
        encoding: 'utf8',
        env: { ...process.env, RELEASE_CANDIDATE: tag, GITHUB_OUTPUT: path.join(dir, 'output') },
      });
      expect(result.status, result.stderr).toBe(0);
      expect(fs.readFileSync(path.join(dir, 'output'), 'utf8')).toBe('eligible=false\n');
    }
  );
  it.each(['v0.1.5', 'v1.2.3.4', ''])(
    'allows numeric tag or default package version (%s)',
    (tag) => {
      const dir = sandbox();
      const result = spawnSync('bash', ['-e', '-c', workflowStep('Select release tag')], {
        encoding: 'utf8',
        env: { ...process.env, RELEASE_CANDIDATE: tag, GITHUB_OUTPUT: path.join(dir, 'output') },
      });
      expect(result.status, result.stderr).toBe(0);
      expect(fs.readFileSync(path.join(dir, 'output'), 'utf8')).toContain('eligible=true');
    }
  );
});
