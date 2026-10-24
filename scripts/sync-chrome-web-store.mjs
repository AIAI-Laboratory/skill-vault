import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { setTimeout } from 'node:timers/promises';
import { compareVersions, versionParts } from './release-version.mjs';

const versions = (revision) =>
  (revision?.distributionChannels || []).map((channel) => channel.crxVersion);

export async function syncStore({
  version,
  zip,
  token,
  publisherId,
  extensionId,
  fetchImpl = fetch,
  sleep = setTimeout,
}) {
  versionParts(version);
  if (!token || !publisherId || !extensionId)
    throw new Error('Missing Chrome Web Store configuration.');
  const name = `publishers/${encodeURIComponent(publisherId)}/items/${encodeURIComponent(extensionId)}`;
  const base = `https://chromewebstore.googleapis.com/v2/${name}`;
  const request = async (url, options = {}) => {
    const response = await fetchImpl(url, {
      ...options,
      headers: { Authorization: `Bearer ${token}`, ...options.headers },
      signal: AbortSignal.timeout(120_000),
    });
    if (!response.ok)
      throw new Error(
        `Chrome Web Store request failed: HTTP ${response.status}. Check the Developer Dashboard and workflow configuration.`
      );
    return response.json();
  };
  let status = await request(`${base}:fetchStatus`);
  if (status.takenDown)
    throw new Error(
      'The listing is taken down. Resolve the policy issue in the Developer Dashboard.'
    );
  const published = status.publishedItemRevisionStatus;
  const submitted = status.submittedItemRevisionStatus;
  const publishedVersions = versions(published);
  const submittedVersions = versions(submitted);
  // Never replace or cancel an active review, even when GitHub has a newer release.
  if (['PENDING_REVIEW', 'STAGED'].includes(submitted?.state)) {
    if (submittedVersions.includes(version) && submitted.state === 'PENDING_REVIEW') {
      return { state: 'pending', message: `${version} is already pending review.` };
    }
    return {
      state: 'deferred',
      message: `Store submission is ${submitted.state}. Keep the current submission; retry the latest GitHub release after it finishes. Staged submissions require publication in the dashboard.`,
    };
  }
  if (
    publishedVersions.length &&
    publishedVersions.every((value) => compareVersions(value, version) === 0)
  ) {
    return { state: 'published', message: `${version} is already published on the Store.` };
  }
  if (publishedVersions.some((value) => compareVersions(value, version) > 0)) {
    throw new Error(`The Store has a version newer than ${version}; refusing to downgrade.`);
  }
  if (submittedVersions.some((value) => compareVersions(value, version) >= 0)) {
    throw new Error(
      `Store submission ${submitted?.state} already contains ${version} or newer. Resolve it in the dashboard or release a higher version.`
    );
  }
  if (['IN_PROGRESS', 'UPLOAD_IN_PROGRESS'].includes(status.lastAsyncUploadState)) {
    return {
      state: 'deferred',
      message: 'A previous upload is still processing. Retry on the next sync.',
    };
  }

  const upload = await request(`https://chromewebstore.googleapis.com/upload/v2/${name}:upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/zip' },
    body: zip,
  });
  if (upload.crxVersion && upload.crxVersion !== version)
    throw new Error('Uploaded Store version does not match the GitHub release.');
  let uploadState = upload.uploadState;
  for (
    let attempt = 0;
    ['IN_PROGRESS', 'UPLOAD_IN_PROGRESS'].includes(uploadState) && attempt < 60;
    attempt++
  ) {
    await sleep(5000);
    status = await request(`${base}:fetchStatus`);
    uploadState = status.lastAsyncUploadState;
  }
  if (uploadState !== 'SUCCEEDED') {
    throw new Error(
      `Upload did not succeed (${uploadState}). Inspect the package in the Developer Dashboard before retrying.`
    );
  }
  const result = await request(`${base}:publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ publishType: 'DEFAULT_PUBLISH' }),
  });
  if (!['PENDING_REVIEW', 'PUBLISHED', 'PUBLISHED_TO_TESTERS'].includes(result.state)) {
    throw new Error(`Unexpected submission state: ${result.state}. Check the Developer Dashboard.`);
  }
  return {
    state: result.state,
    message: `Submitted ${version}: ${result.state}. Google publishes it after approval using the listing's distribution settings.`,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const tag = process.env.RELEASE_VERSION;
    const version = tag?.replace(/^v/, '');
    versionParts(version);
    if (tag !== `v${version}`) throw new Error('Expected a release tag starting with v.');
    const manifest = JSON.parse(
      fs.readFileSync(process.env.CWS_MANIFEST_PATH || 'store-package/manifest.json', 'utf8')
    );
    if (manifest.version !== version)
      throw new Error('Release ZIP manifest.version must match its GitHub release tag.');
    const result = await syncStore({
      version,
      zip: fs.readFileSync(process.env.CWS_ZIP_PATH || 'store-package/skill-vault.zip'),
      token: process.env.CWS_TOKEN,
      publisherId: process.env.CWS_PUBLISHER_ID,
      extensionId: process.env.CWS_EXTENSION_ID,
    });
    console.log(result.message);
    if (process.env.GITHUB_STEP_SUMMARY)
      fs.appendFileSync(
        process.env.GITHUB_STEP_SUMMARY,
        `### Chrome Web Store sync\n\n${result.message}\n`
      );
    if (result.state === 'deferred') console.log(`::warning::${result.message}`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
