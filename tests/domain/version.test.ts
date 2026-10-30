import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  APP_VERSION,
  formatVersion,
  stripVersionPrefix,
  parseVersionParts,
  compareSemver,
  isUpdateAvailable,
  getCurrentAppVersion,
  getCurrentAppVersionName,
} from '../../src/domain/version';

describe('Version Domain Utilities', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /** Tests formatting of versions with and without leading 'v'. */
  it('formats versions with a leading v', () => {
    expect(formatVersion('0.1.4')).toBe('v0.1.4');
    expect(formatVersion('v0.1.4')).toBe('v0.1.4');
    expect(formatVersion('  1.0.0 ')).toBe('v1.0.0');
  });

  /** Tests stripping of leading 'v' prefix. */
  it('strips leading v prefix from version strings', () => {
    expect(stripVersionPrefix('v0.1.4')).toBe('0.1.4');
    expect(stripVersionPrefix('0.1.4')).toBe('0.1.4');
    expect(stripVersionPrefix('  v2.0.0  ')).toBe('2.0.0');
  });

  /** Tests parsing valid version strings into 4-number tuples. */
  it('parses valid version strings into 4 segments', () => {
    expect(parseVersionParts('0.1.4')).toEqual([0, 1, 4, 0]);
    expect(parseVersionParts('v1.2.3.4')).toEqual([1, 2, 3, 4]);
    expect(parseVersionParts('2.0')).toEqual([2, 0, 0, 0]);
    expect(parseVersionParts('5')).toEqual([5, 0, 0, 0]);
  });

  /** Tests rejection of invalid version strings. */
  it('throws an error on invalid or out-of-range versions', () => {
    // Non-string input
    expect(() => parseVersionParts(123 as unknown as string)).toThrow('Invalid version format');
    // All zeros
    expect(() => parseVersionParts('0.0.0.0')).toThrow('Invalid version: cannot be all zeros');
    // Invalid characters
    expect(() => parseVersionParts('1.0.0-beta')).toThrow('Invalid semantic version');
    expect(() => parseVersionParts('alpha')).toThrow('Invalid semantic version');
    // Segment out of range
    expect(() => parseVersionParts('1.65536.0')).toThrow('Version segment out of range');
    // Leading zeroes in segments
    expect(() => parseVersionParts('01.2.3')).toThrow('Invalid semantic version');
  });

  /** Tests comparing versions with standard semantic ordering. */
  it('compares versions correctly', () => {
    expect(compareSemver('0.1.4', '0.1.4')).toBe(0);
    expect(compareSemver('v0.1.4', '0.1.4')).toBe(0);
    expect(compareSemver('0.1.4', '0.1.5')).toBe(-1);
    expect(compareSemver('0.1.5', '0.1.4')).toBe(1);
    expect(compareSemver('0.2.0', '0.1.99')).toBe(1);
    expect(compareSemver('1.0.0', '0.9.9')).toBe(1);
    expect(compareSemver('0.1.4.1', '0.1.4.2')).toBe(-1);
    expect(compareSemver('0.1.4.2', '0.1.4.1')).toBe(1);
  });

  /** Tests isUpdateAvailable returns true only when candidate is strictly newer. */
  it('detects when an update is available', () => {
    expect(isUpdateAvailable('0.1.4', '0.1.5')).toBe(true);
    expect(isUpdateAvailable('0.1.4', 'v0.2.0')).toBe(true);
    expect(isUpdateAvailable('0.1.4', '0.1.4')).toBe(false);
    expect(isUpdateAvailable('0.1.4', '0.1.3')).toBe(false);
    expect(isUpdateAvailable('0.1.4', 'invalid-version')).toBe(false);
  });

  /** Tests resolving current version from chrome manifest or fallback. */
  it('resolves current app version from chrome.runtime or fallback constant', () => {
    // Without chrome.runtime
    expect(getCurrentAppVersion()).toBe(APP_VERSION);
    expect(getCurrentAppVersionName()).toBe(`v${APP_VERSION}`);

    // With chrome.runtime.getManifest
    /** Mock getManifest returning version 0.2.5. */
    const mockGetManifest = () => ({ version: '0.2.5' });
    vi.stubGlobal('chrome', {
      runtime: {
        getManifest: mockGetManifest,
      },
    });

    expect(getCurrentAppVersion()).toBe('0.2.5');
    expect(getCurrentAppVersionName()).toBe('v0.2.5');
  });

  /** Tests fallback behavior when getManifest throws an exception. */
  it('falls back to APP_VERSION if getManifest throws', () => {
    /** Mock getManifest throwing an error. */
    const throwingGetManifest = () => {
      throw new Error('Manifest unavailable');
    };
    vi.stubGlobal('chrome', {
      runtime: {
        getManifest: throwingGetManifest,
      },
    });

    expect(getCurrentAppVersion()).toBe(APP_VERSION);
  });
});
