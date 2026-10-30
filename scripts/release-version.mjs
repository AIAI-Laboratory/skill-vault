import fs from 'node:fs';

export function versionParts(version) {
  if (typeof version !== 'string' || !/^(0|[1-9]\d*)(\.(0|[1-9]\d*)){0,3}$/.test(version)) {
    throw new Error(`Invalid Chrome extension version: ${version}`);
  }
  const parts = version.split('.').map(Number);
  if (parts.some((part) => part > 65535) || parts.every((part) => part === 0)) {
    throw new Error(`Invalid Chrome extension version: ${version}`);
  }
  return [...parts, 0, 0, 0].slice(0, 4);
}

export function compareVersions(left, right) {
  const a = versionParts(left);
  const b = versionParts(right);
  for (let i = 0; i < 4; i++) {
    if (a[i] !== b[i]) return Math.sign(a[i] - b[i]);
  }
  return 0;
}

export function validateReleaseVersion(packageVersion, manifestVersion, tag) {
  versionParts(packageVersion);
  if (packageVersion !== manifestVersion) {
    throw new Error(
      'package.json and manifest.json versions must match. Run npm version <version> --no-git-tag-version.'
    );
  }
  const expectedTag = `v${packageVersion}`;
  if (tag && tag !== expectedTag) {
    throw new Error(`Release tag ${tag} must match ${expectedTag}.`);
  }
  return expectedTag;
}

export function readReleaseVersion(root, tag) {
  const read = (file) => JSON.parse(fs.readFileSync(new URL(file, root), 'utf8'));
  return validateReleaseVersion(
    read('package.json').version,
    read('public/manifest.json').version,
    tag
  );
}
