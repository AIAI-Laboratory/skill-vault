import { afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { compareVersions, validateReleaseVersion, versionParts } from './release-version.mjs';
import { syncStore } from './sync-chrome-web-store.mjs';

const temporary = [];
afterEach(() =>
  temporary.splice(0).forEach((dir) => fs.rmSync(dir, { recursive: true, force: true }))
);
const fixture = () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-vault-release-'));
  temporary.push(dir);
  fs.mkdirSync(path.join(dir, 'scripts'));
  fs.mkdirSync(path.join(dir, 'public'));
  fs.mkdirSync(path.join(dir, 'dist'));
  for (const file of ['release-version.mjs', 'sync-manifest-version.mjs', 'package.mjs']) {
    fs.copyFileSync(new URL(file, import.meta.url), path.join(dir, 'scripts', file));
  }
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ version: '0.1.4' }));
  fs.writeFileSync(
    path.join(dir, 'public/manifest.json'),
    '{"version": "0.1.4", "manifest_version": 3}'
  );
  fs.copyFileSync(path.join(dir, 'public/manifest.json'), path.join(dir, 'dist/manifest.json'));
  return dir;
};
const response = (body) => ({ ok: true, json: async () => body });
const revision = (state, version) => ({ state, distributionChannels: [{ crxVersion: version }] });
const harness = (...bodies) => {
  const fetchImpl = vi.fn();
  bodies.forEach((body) => fetchImpl.mockResolvedValueOnce(response(body)));
  const options = {
    version: '0.1.4',
    zip: Buffer.from('published ZIP bytes'),
    token: 'test-token',
    publisherId: 'publisher',
    extensionId: 'extension',
    fetchImpl,
    sleep: vi.fn().mockResolvedValue(undefined),
  };
  return { options, fetchImpl };
};

describe('release version integrity', () => {
  it.each(['0', '0.0.0', '01.2.3', '1.2.65536', '1.2.3-beta', '1.2.3.4.5', 'v0.1.4', 'main'])(
    'rejects invalid Chrome version %s',
    (version) => {
      expect(() => versionParts(version)).toThrow('Invalid Chrome');
    }
  );
  it('compares numerically and pads short Chrome versions', () => {
    expect(compareVersions('0.1.10', '0.1.9')).toBe(1);
    expect(compareVersions('1.2', '1.2.0.0')).toBe(0);
    expect(compareVersions('1.2.0.1', '1.2.1')).toBe(-1);
  });
  it('requires the tag and both source versions to agree', () => {
    expect(validateReleaseVersion('0.1.4', '0.1.4', 'v0.1.4')).toBe('v0.1.4');
    expect(() => validateReleaseVersion('0.1.4', '0.1.1', 'v0.1.4')).toThrow('versions must match');
    expect(() => validateReleaseVersion('0.1.1', '0.1.1', 'v0.1.4')).toThrow('must match v0.1.1');
  });
  it('updates the manifest from the npm package version without reformatting other fields', () => {
    const dir = fixture();
    fs.writeFileSync(
      path.join(dir, 'public/manifest.json'),
      '{"version": "0.1.1", "manifest_version": 3}'
    );
    const result = spawnSync(process.execPath, ['scripts/sync-manifest-version.mjs'], {
      cwd: dir,
      encoding: 'utf8',
    });
    expect(result.status).toBe(0);
    expect(fs.readFileSync(path.join(dir, 'public/manifest.json'), 'utf8')).toBe(
      '{"version": "0.1.4", "manifest_version": 3}'
    );
  });
  it('refuses a mismatching release tag before creating a ZIP', () => {
    const dir = fixture();
    const result = spawnSync(process.execPath, ['scripts/package.mjs'], {
      cwd: dir,
      env: { ...process.env, RELEASE_VERSION: 'v0.1.5' },
      encoding: 'utf8',
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('must match v0.1.4');
    expect(fs.existsSync(path.join(dir, 'skill-vault-v0.1.5.zip'))).toBe(false);
  });
  it('rejects a stale build even when source versions match', () => {
    const dir = fixture();
    fs.writeFileSync(path.join(dir, 'dist/manifest.json'), '{"version":"0.1.1"}');
    const result = spawnSync(process.execPath, ['scripts/package.mjs'], {
      cwd: dir,
      env: { ...process.env, RELEASE_VERSION: 'v0.1.4' },
      encoding: 'utf8',
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('versions must match');
  });
});

describe('Chrome Web Store release delivery', () => {
  it('uploads the exact published ZIP and requests automatic publication after review', async () => {
    const { options, fetchImpl } = harness(
      {},
      { uploadState: 'SUCCEEDED', crxVersion: '0.1.4' },
      { state: 'PENDING_REVIEW' }
    );
    expect((await syncStore(options)).state).toBe('PENDING_REVIEW');
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(fetchImpl.mock.calls[1][1].body).toBe(options.zip);
    expect(fetchImpl.mock.calls[1][0]).toContain(
      '/upload/v2/publishers/publisher/items/extension:upload'
    );
    expect(JSON.parse(fetchImpl.mock.calls[2][1].body)).toEqual({ publishType: 'DEFAULT_PUBLISH' });
  });
  it('preserves an older pending review and defers the newer release', async () => {
    const { options, fetchImpl } = harness({
      submittedItemRevisionStatus: revision('PENDING_REVIEW', '0.1.1'),
    });
    expect((await syncStore(options)).state).toBe('deferred');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
  it('does not resubmit a version already under review', async () => {
    const { options, fetchImpl } = harness({
      submittedItemRevisionStatus: revision('PENDING_REVIEW', '0.1.4'),
    });
    expect((await syncStore(options)).state).toBe('pending');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
  it('does not re-upload a published version', async () => {
    const { options, fetchImpl } = harness({
      publishedItemRevisionStatus: revision('PUBLISHED', '0.1.4'),
    });
    expect((await syncStore(options)).state).toBe('published');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
  it('submits the latest release after the previous review has published', async () => {
    const { options } = harness(
      { publishedItemRevisionStatus: revision('PUBLISHED', '0.1.1') },
      { uploadState: 'SUCCEEDED', crxVersion: '0.1.4' },
      { state: 'PENDING_REVIEW' }
    );
    expect((await syncStore(options)).state).toBe('PENDING_REVIEW');
  });
  it('does not downgrade a newer Store version', async () => {
    const { options, fetchImpl } = harness({
      publishedItemRevisionStatus: revision('PUBLISHED', '0.1.5'),
    });
    await expect(syncStore(options)).rejects.toThrow('refusing to downgrade');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
  it.each(['REJECTED', 'CANCELLED'])(
    'does not endlessly resubmit the same %s version',
    async (state) => {
      const { options, fetchImpl } = harness({
        submittedItemRevisionStatus: revision(state, '0.1.4'),
      });
      await expect(syncStore(options)).rejects.toThrow('dashboard or release a higher version');
      expect(fetchImpl).toHaveBeenCalledTimes(1);
    }
  );
  it('allows a higher version to fix a rejected submission', async () => {
    const { options } = harness(
      { submittedItemRevisionStatus: revision('REJECTED', '0.1.3') },
      { uploadState: 'SUCCEEDED', crxVersion: '0.1.4' },
      { state: 'PENDING_REVIEW' }
    );
    expect((await syncStore(options)).state).toBe('PENDING_REVIEW');
  });
  it('preserves a staged submission', async () => {
    const { options, fetchImpl } = harness({
      submittedItemRevisionStatus: revision('STAGED', '0.1.3'),
    });
    expect((await syncStore(options)).state).toBe('deferred');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
  it('waits for async upload completion before submitting', async () => {
    const { options, fetchImpl } = harness(
      {},
      { uploadState: 'IN_PROGRESS' },
      { lastAsyncUploadState: 'IN_PROGRESS' },
      { lastAsyncUploadState: 'SUCCEEDED' },
      { state: 'PENDING_REVIEW' }
    );
    expect((await syncStore(options)).state).toBe('PENDING_REVIEW');
    expect(options.sleep).toHaveBeenCalledTimes(2);
    expect(fetchImpl.mock.calls[4][0]).toMatch(/:publish$/);
  });
  it('does not interrupt a previous async upload', async () => {
    const { options, fetchImpl } = harness({ lastAsyncUploadState: 'IN_PROGRESS' });
    expect((await syncStore(options)).state).toBe('deferred');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
  it.each(['FAILED', 'NOT_FOUND', undefined])(
    'does not publish after an unsuccessful upload (%s)',
    async (uploadState) => {
      const { options, fetchImpl } = harness({}, { uploadState });
      await expect(syncStore(options)).rejects.toThrow('Upload did not succeed');
      expect(fetchImpl).toHaveBeenCalledTimes(2);
    }
  );
  it('bounds async polling and never submits an unfinished upload', async () => {
    const { options, fetchImpl } = harness({}, { uploadState: 'IN_PROGRESS' });
    fetchImpl.mockResolvedValue(response({ lastAsyncUploadState: 'IN_PROGRESS' }));
    await expect(syncStore(options)).rejects.toThrow('Upload did not succeed');
    expect(options.sleep).toHaveBeenCalledTimes(60);
    expect(fetchImpl.mock.calls.some(([url]) => url.endsWith(':publish'))).toBe(false);
  });
  it('rejects a mismatching uploaded version before submission', async () => {
    const { options, fetchImpl } = harness({}, { uploadState: 'SUCCEEDED', crxVersion: '0.1.1' });
    await expect(syncStore(options)).rejects.toThrow('does not match');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
  it('surfaces API errors without publishing', async () => {
    const { options, fetchImpl } = harness();
    fetchImpl.mockResolvedValue({ ok: false, status: 403 });
    await expect(syncStore(options)).rejects.toThrow('HTTP 403');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
  it('blocks taken-down listings', async () => {
    const { options, fetchImpl } = harness({ takenDown: true });
    await expect(syncStore(options)).rejects.toThrow('taken down');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
