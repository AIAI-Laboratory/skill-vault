import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { versionParts, compareVersions } from './release-version.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

/**
 * Reads a JSON file relative to the project root directory.
 *
 * @param {string} relativePath - Relative path from project root.
 * @returns {Record<string, unknown>} Parsed JSON content.
 */
function readJson(relativePath) {
  const fullPath = path.join(rootDir, relativePath);
  return JSON.parse(fs.readFileSync(fullPath, 'utf8'));
}

/**
 * Extracts and validates the application version across configuration files.
 *
 * @returns {{ version: string; manifestVersion: string }} Current version numbers.
 */
function getAppVersions() {
  const pkg = readJson('package.json');
  const manifest = readJson('public/manifest.json');
  const version = String(pkg.version);
  const manifestVersion = String(manifest.version);

  versionParts(version);
  versionParts(manifestVersion);

  return { version, manifestVersion };
}

/**
 * Queries the remote repository for the latest release version.
 *
 * @param {string} repo - The GitHub repository slug (owner/repo).
 * @returns {Promise<{ latestTag: string; releaseName: string; hasUpdate: boolean } | null>}
 */
async function checkRemoteRelease(repo = 'AIAI-Laboratory/skill-vault') {
  try {
    const res = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, {
      headers: {
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'SkillVault-CLI',
      },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const tag = data.tag_name || '';
    const cleanTag = tag.replace(/^v/, '');
    const current = getAppVersions().version;
    const hasUpdate = compareVersions(current, cleanTag) < 0;
    return {
      latestTag: tag,
      releaseName: data.name || tag,
      hasUpdate,
    };
  } catch {
    return null;
  }
}

/**
 * Main execution function printing version and diagnostic information.
 */
async function main() {
  const { version, manifestVersion } = getAppVersions();
  const isJson = process.argv.includes('--json');
  const shouldCheckRemote = process.argv.includes('--check-remote');

  let remoteInfo = null;
  if (shouldCheckRemote) {
    remoteInfo = await checkRemoteRelease();
  }

  if (isJson) {
    console.log(
      JSON.stringify(
        {
          name: 'Skill Vault',
          version,
          manifestVersion,
          schemaVersion: 1,
          platform: 'Chrome Extension (Manifest V3)',
          repository: 'AIAI-Laboratory/skill-vault',
          remote: remoteInfo,
        },
        null,
        2
      )
    );
    return;
  }

  console.log('Skill Vault - Universal local-first prompt layer');
  console.log(`Version:          v${version}`);
  console.log(`Manifest Version: v${manifestVersion}`);
  console.log(`Schema Version:   1`);
  console.log(`Platform:         Chrome Extension (MV3)`);
  console.log(`Repository:       https://github.com/AIAI-Laboratory/skill-vault`);

  if (remoteInfo) {
    if (remoteInfo.hasUpdate) {
      console.log(`\nUpdate available: ${remoteInfo.latestTag} (${remoteInfo.releaseName})`);
    } else {
      console.log(`\nStatus: Up to date (latest release is ${remoteInfo.latestTag})`);
    }
  }
}

/**
 * Reports fatal errors and terminates the process.
 *
 * @param {unknown} err - The encountered error.
 */
function handleFatalError(err) {
  console.error('Error reading version info:', err);
  process.exit(1);
}

main().catch(handleFatalError);
