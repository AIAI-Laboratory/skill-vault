/**
 * Semantic version management and comparison utilities for Skill Vault.
 */

/** The current application version string conforming to Semantic Versioning. */
export const APP_VERSION = '0.1.4';

/**
 * Normalizes a version string into a canonical 'vX.Y.Z' display format.
 *
 * @param version - The raw version string (e.g. "0.1.4" or "v0.1.4").
 * @returns The version string prefixed with 'v'.
 */
export function formatVersion(version: string): string {
  const trimmed = version.trim();
  return trimmed.startsWith('v') ? trimmed : `v${trimmed}`;
}

/**
 * Strips any leading 'v' prefix from a version string.
 *
 * @param version - The raw version string (e.g. "v0.1.4" or "0.1.4").
 * @returns The version string without the leading 'v'.
 */
export function stripVersionPrefix(version: string): string {
  return version.trim().replace(/^v/, '');
}

/**
 * Validates and converts an individual version segment to a numeric value.
 *
 * @param segment - String representing an individual version segment.
 * @returns Validated numeric representation.
 * @throws Error if the segment is out of range.
 */
function parseSegment(segment: string): number {
  const num = Number(segment);
  if (!Number.isSafeInteger(num) || num < 0 || num > 65535) {
    throw new Error(`Version segment out of range (0-65535): ${segment}`);
  }
  return num;
}

/**
 * Checks whether a version segment equals zero.
 *
 * @param part - The numeric segment.
 * @returns True if part equals zero.
 */
function isZeroSegment(part: number): boolean {
  return part === 0;
}

/**
 * Parses a semantic version string into up to 4 numeric components.
 *
 * @param version - The version string to parse (e.g. "0.1.4", "v1.2.3.4").
 * @returns A tuple of four numeric parts [major, minor, patch, build].
 * @throws Error when the version format is invalid or out of range.
 */
export function parseVersionParts(version: string): [number, number, number, number] {
  if (typeof version !== 'string') {
    throw new Error(`Invalid version format: expected string, got ${typeof version}`);
  }
  const clean = stripVersionPrefix(version);
  if (!/^(0|[1-9]\d*)(\.(0|[1-9]\d*)){0,3}$/.test(clean)) {
    throw new Error(`Invalid semantic version: ${version}`);
  }
  const parts = clean.split('.').map(parseSegment);
  if (parts.every(isZeroSegment)) {
    throw new Error(`Invalid version: cannot be all zeros (${version})`);
  }
  return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0, parts[3] ?? 0];
}

/**
 * Compares two semantic version strings.
 *
 * @param left - The first version string to compare.
 * @param right - The second version string to compare.
 * @returns -1 if left is older than right, 0 if equal, 1 if left is newer than right.
 * @throws Error when either version string is not valid.
 */
export function compareSemver(left: string, right: string): number {
  const a = parseVersionParts(left);
  const b = parseVersionParts(right);
  for (let i = 0; i < 4; i++) {
    if (a[i] !== b[i]) {
      return Math.sign(a[i] - b[i]);
    }
  }
  return 0;
}

/**
 * Determines whether a candidate version is strictly newer than the current version.
 *
 * @param currentVersion - The active version of the application.
 * @param candidateVersion - The prospective version detected from a release.
 * @returns True when candidateVersion is strictly greater than currentVersion.
 */
export function isUpdateAvailable(currentVersion: string, candidateVersion: string): boolean {
  try {
    return compareSemver(currentVersion, candidateVersion) < 0;
  } catch {
    return false;
  }
}

/**
 * Resolves the currently running extension version from the Chrome manifest if available,
 * or falls back to the embedded application version constant.
 *
 * @returns The current semantic version string without a leading 'v'.
 */
export function getCurrentAppVersion(): string {
  if (typeof chrome !== 'undefined' && chrome.runtime?.getManifest) {
    try {
      const manifest = chrome.runtime.getManifest();
      if (manifest?.version) {
        return manifest.version;
      }
    } catch {
      // Fallback below
    }
  }
  return APP_VERSION;
}

/**
 * Resolves the current application version formatted with a 'v' prefix.
 *
 * @returns The formatted version string (e.g. "v0.1.4").
 */
export function getCurrentAppVersionName(): string {
  return formatVersion(getCurrentAppVersion());
}
