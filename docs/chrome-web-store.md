# Chrome Web Store CI/CD

GitHub and Chrome Web Store use the same version and the same ZIP. Publishing a
stable GitHub Release triggers store delivery. Google reviews that package and
publishes it after approval, so the publicly visible Store version can lag behind
GitHub while review is pending.

## One-time configuration

1. Enable the Chrome Web Store API in the service account's Google Cloud project.
2. Add the service account email in the Chrome Web Store Developer Dashboard under
   **Publisher → Settings → Service account**.
3. Configure these values in **GitHub repository → Settings → Secrets and variables → Actions**:

| Type     | Name                       | Value                                            |
| -------- | -------------------------- | ------------------------------------------------ |
| Secret   | `CWS_SERVICE_ACCOUNT_JSON` | Complete JSON key for the linked service account |
| Variable | `CWS_PUBLISHER_ID`         | Publisher ID shown in the Developer Dashboard    |
| Variable | `CWS_EXTENSION_ID`         | Existing extension item ID                       |

Keep credentials private. Never commit JSON key files or put them in an extension
package. Local environment settings are not automatically available to Actions.

## Release a new version

On a contribution branch, update the version once:

```bash
npm version 0.1.4 --no-git-tag-version
```

The npm version lifecycle updates `public/manifest.json` alongside `package.json`
and `package-lock.json`. Commit those files, open a PR and merge after verification.
From the merged commit, create and push the matching tag:

```bash
git tag v0.1.4
git push origin v0.1.4
```

The `Release Extension` workflow verifies, builds and packages that commit, then
prepares a **draft** GitHub Release. Build and packaging fail if the tag,
`package.json`, source manifest or packaged manifest disagree. Manual builds use
the package version and ignore branch names. A manual release-workflow run with a
tag input checks out that tag, rather than building the current branch.

Review the draft and click **Publish release** on GitHub. The `Chrome Web Store`
workflow downloads the versioned ZIP from the latest public stable GitHub Release,
checks its manifest against the release tag, uploads those exact bytes and submits
with automatic publication after approval. It does not rebuild the extension.
The release workflow refuses to overwrite assets of an already published release.
Do not edit published assets manually; make a new version for changes.

Publishing a release with a workflow's `GITHUB_TOKEN` does not trigger a separate
release-event workflow. The draft-first flow avoids this: a maintainer publishes
the draft from GitHub or with their own CLI credentials. The hourly sync also
picks up public stable releases if a release event is missed. Drafts and
prereleases are excluded from Store delivery.

## While another version is pending

An active review is preserved. A sync reports that it is deferred, then the hourly
workflow checks again. When review completes, the next run submits the latest
public stable GitHub Release. If you publish several releases during a review,
intermediate releases are superseded: the Store catches up to the latest release.
GitHub scheduling may be delayed; hourly is the requested cadence, not a deadline.

The same version already pending or published is a successful no-op. A rejected or
cancelled submission of the same version needs dashboard attention or a higher
release version. A staged submission must be published in the dashboard before
sync continues. The workflow does not cancel reviews or downgrade a newer Store
version. Listing metadata, privacy disclosures and distribution settings remain
managed in the Developer Dashboard.

A successful submission means Google accepted it for processing; it does not mean
review has completed or that all installed browsers have updated.

## Manual checks and retry

Open **Actions → Chrome Web Store → Run workflow**:

- **status** (default) authenticates and reads the listing status without uploading.
- **sync** retries the latest public stable GitHub Release with the same checks as
  automatic runs. It cannot upload an unpublished draft or choose another ZIP.

```bash
gh workflow run chrome-web-store.yml --ref main -f operation=status
gh workflow run chrome-web-store.yml --ref main -f operation=sync
```

Read the job summary for published, pending, deferred or submitted status. A failed
upload, API error or rejected submission fails the job for inspection. After fixing
listing or configuration issues, rerun **sync**; hourly runs also retry.

## Troubleshooting

- **403 / PERMISSION_DENIED:** check the linked service account, API enablement and
  both repository variables.
- **Version mismatch:** use `npm version <version> --no-git-tag-version`, commit all
  three version files and use a matching tag. Renaming a ZIP does not change its
  extension version.
- **Older public release with a mismatching ZIP:** publish a corrected higher
  version; the sync deliberately refuses the mismatching release.
- **Listing or privacy errors:** complete the required dashboard fields, including
  the public privacy-policy URL.
- **Upload timeout:** inspect the dashboard package before retrying. If the upload
  is still processing, the next sync defers instead of interrupting it.

See Google's documentation for [API usage](https://developer.chrome.com/docs/webstore/using-api),
[service accounts](https://developer.chrome.com/docs/webstore/service-accounts) and
[submission states](https://developer.chrome.com/docs/webstore/api/reference/rest/v2/ItemState).
