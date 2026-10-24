# Chrome Web Store CI/CD

GitHub and Chrome Web Store use the same version and the same ZIP. Publishing a
stable GitHub Release triggers packaging and store delivery. Google reviews that
package and publishes it after approval, so the publicly visible Store version can lag behind
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

Choose the version in **GitHub → Releases → Draft a new release → Choose a tag**.
For example, enter `v0.1.5`, choose the intended code commit (normally `main`), then
save the draft or publish when ready. The **tag** controls the extension version;
the release title is display text and can be anything.

You do not need to edit or commit version files first. During packaging, CD takes
`0.1.5` from `v0.1.5` and stamps `package.json`, `package-lock.json` and
`public/manifest.json` in its disposable checkout. The source commit and `main`
are not changed. Existing validation still requires the prepared metadata, built
manifest, release tag and ZIP version to agree.

Saving a draft alone does not submit to the Store. Publishing a stable release
builds its selected tag and attaches the ZIPs. Alternatively, pushing a numeric
tag runs packaging and creates a draft automatically:

```bash
git tag v0.1.5
git push origin v0.1.5
```

A manual `Release Extension` run with a tag input checks out that tag and uses it
as the build version. A manual run without a tag falls back to `package.json`.
Ordinary local builds use the checked-in development version; they do not change
the repository's files automatically.

Review the draft and click **Publish release** on GitHub. The `Chrome Web Store`
workflow downloads the versioned ZIP from the latest public stable GitHub Release,
checks its manifest against the release tag, uploads those exact bytes and submits
with automatic publication after approval. It does not rebuild the extension.
You can also create a draft in GitHub's release editor. Saving a draft does not
trigger Store delivery. When you publish it, `Release Extension` builds the tag
and adds the ZIPs if they are missing. If the Store workflow runs before the ZIP
is ready, it reports that it is waiting; successful packaging triggers another
sync. A release with both ZIPs already published is a no-op, so tag
pushes, publication events and reruns preserve its assets. A partly uploaded ZIP
pair requires inspection. Published ZIPs are never overwritten by the workflow.
Do not edit published assets manually; make a new version for changes.

Publishing a release with a workflow's `GITHUB_TOKEN` does not trigger a separate
release-event workflow. The draft-first flow avoids this: a maintainer publishes
the draft from GitHub or with their own CLI credentials. The sync after a
successful `Release Extension` run and the hourly retry also pick up public stable releases if a publication event is missed. Delivery runs
trusted code from `main`; it does not run code or consume build artifacts from the
completed run. Failed builds and foreign-repository runs do not trigger delivery.

Store selection scans paginated releases and chooses the highest numeric Chrome
version, regardless of GitHub's manually selected Latest flag. Drafts, prereleases
and non-numeric tags such as `v0.1.4-beta` are excluded, even if a beta was
accidentally published as a stable release. Beta tags are also skipped by the
packaging workflow. For GitHub-only beta announcements, select **Set as a
pre-release**. This pipeline does not build beta ZIPs or submit them to the Store.

Use numeric tags such as `v0.1.5` or `v0.1.6`; each Store update must have a higher
numeric version. The development version in the tagged source may be older: CD
sets the released extension version from the tag automatically.

## While another version is pending

An active review is preserved. A sync reports that it is deferred, then the hourly
workflow checks again. When review completes, the next run submits the latest
public stable GitHub Release. If you publish several releases during a review,
intermediate releases are superseded: the Store catches up to the latest release.
GitHub scheduling may be delayed; hourly is the requested cadence, not a deadline.

If the highest stable release has no complete versioned ZIP, sync waits for it
instead of sending an older package.

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
- **Version mismatch in an old workflow:** rerun `Release Extension` from `main`
  with the existing release tag as `tag_name`. The updated workflow stamps the
  build metadata even when that tag points to older development version files.
  Rerunning an old failed run reuses its old workflow definition.
- **Invalid version:** use a numeric tag accepted by Chrome. The tag, rather than
  the release title or ZIP filename, determines the packaged extension version.
- **Beta shown as Latest:** beta tags are ignored by Store delivery even if the
  GitHub prerelease flag was omitted.
- **Release published before its ZIPs:** the packaging workflow fills missing ZIPs
  and triggers sync on completion; no manual upload is normally needed.
- **Older public release with a mismatching ZIP:** publish a corrected higher
  version; the sync deliberately refuses the mismatching release.
- **Listing or privacy errors:** complete the required dashboard fields, including
  the public privacy-policy URL.
- **Upload timeout:** inspect the dashboard package before retrying. If the upload
  is still processing, the next sync defers instead of interrupting it.

See Google's documentation for [API usage](https://developer.chrome.com/docs/webstore/using-api),
[service accounts](https://developer.chrome.com/docs/webstore/service-accounts) and
[submission states](https://developer.chrome.com/docs/webstore/api/reference/rest/v2/ItemState).
