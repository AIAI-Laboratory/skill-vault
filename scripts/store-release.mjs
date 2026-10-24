import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { compareVersions, versionParts } from './release-version.mjs';

export function selectStoreRelease(releases) {
  const candidates = releases.filter((release) => {
    if (release.draft || release.prerelease || !release.tag_name?.startsWith('v')) return false;
    try {
      versionParts(release.tag_name.slice(1));
      return true;
    } catch {
      return false;
    }
  });
  candidates.sort(
    (a, b) =>
      compareVersions(b.tag_name.slice(1), a.tag_name.slice(1)) ||
      String(b.published_at).localeCompare(String(a.published_at))
  );
  const release = candidates[0];
  if (!release)
    return { state: 'empty', message: 'No public stable numeric extension release to sync.' };
  const tag = release.tag_name;
  const ready = release.assets?.some(
    (asset) =>
      asset.name === `skill-vault-${tag}.zip` && asset.state === 'uploaded' && asset.size > 0
  );
  if (!ready)
    return {
      state: 'waiting',
      message: `${tag} is published but its versioned ZIP is not ready. Retry after Release Extension completes or on the next hourly sync.`,
    };
  return { state: 'ready', tag, message: `Selected ${tag} for Chrome Web Store sync.` };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const repo = process.env.GH_REPO || process.env.GITHUB_REPOSITORY;
    if (!repo) throw new Error('Missing GitHub repository.');
    const pages = JSON.parse(
      execFileSync('gh', ['api', '--paginate', '--slurp', `repos/${repo}/releases?per_page=100`], {
        encoding: 'utf8',
      })
    );
    const result = selectStoreRelease(pages.flat());
    console.log(result.message);
    if (process.env.GITHUB_STEP_SUMMARY)
      fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${result.message}\n`);
    if (result.state === 'ready') {
      fs.appendFileSync(process.env.GITHUB_OUTPUT, `tag=${result.tag}\n`);
      fs.appendFileSync(process.env.GITHUB_ENV, `RELEASE_VERSION=${result.tag}\n`);
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
