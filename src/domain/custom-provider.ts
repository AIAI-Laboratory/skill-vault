export const BUILT_IN_ORIGINS = [
  'https://chatgpt.com',
  'https://claude.ai',
  'https://gemini.google.com',
];

export function normalizeProviderUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error('Enter a valid URL starting with http:// or https://.');
  }
  if (
    !['https:', 'http:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.hostname.includes('*')
  ) {
    throw new Error('Use an HTTP or HTTPS URL without credentials or wildcards.');
  }
  if (BUILT_IN_ORIGINS.includes(url.origin)) {
    throw new Error('This provider is already included above.');
  }
  return url.origin;
}

export function normalizeProviderUrls(values: string[]): string[] {
  if (!Array.isArray(values) || values.some((value) => typeof value !== 'string')) {
    throw new Error('Custom providers must be a list of URLs.');
  }
  const urls = values.map(normalizeProviderUrl);
  if (new Set(urls).size !== urls.length) throw new Error('This provider URL is already added.');
  return urls;
}

export function providerMatchPattern(origin: string): string {
  const url = new URL(origin);
  // Chrome match patterns apply to every port; runtime matching checks the exact origin.
  return `${url.protocol}//${url.hostname}/*`;
}
