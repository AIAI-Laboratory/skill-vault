# Chrome Web Store CI/CD

The `Chrome Web Store` GitHub Actions workflow uses the Chrome Web Store API v2 to update the existing Skill Vault listing. The separate `Release Extension` workflow builds ZIP files and prepares a **draft** GitHub Release. Publishing that release triggers delivery to Chrome Web Store.

## One-time configuration

1. Enable the Chrome Web Store API in the service account's Google Cloud project.
2. Add the service account email under **Publisher → Settings → Service account** in the Chrome Web Store Developer Dashboard. This grants access to all items owned by that publisher.
3. Configure these values in **GitHub repository → Settings → Secrets and variables → Actions**:

| Type     | Name                       | Value                                            |
| -------- | -------------------------- | ------------------------------------------------ |
| Secret   | `CWS_SERVICE_ACCOUNT_JSON` | Complete JSON key for the linked service account |
| Variable | `CWS_PUBLISHER_ID`         | Publisher ID shown in the Developer Dashboard    |
| Variable | `CWS_EXTENSION_ID`         | Existing extension item ID                       |

Local `.env` values are not automatically available to GitHub Actions. They must also be configured in GitHub. Keep `.env` and JSON key files private; never commit them. The workflow does not bundle credentials into the extension.

## Check access without uploading

Open **Actions → Chrome Web Store → Run workflow** and run against `main`. Manual runs are read-only. This authenticates, reads the listing status, and writes a job summary. It does not upload, submit, cancel a review, or publish anything.

Using the GitHub CLI:

```bash
gh workflow run chrome-web-store.yml --ref main
```

## Release a new version

Increase `version` in `public/manifest.json` and `package.json`, commit the release changes, and push them. The tag must exactly match the manifest version:

```bash
git tag v0.1.2
git push origin v0.1.2
```

Pushing a `v*` tag runs the `Release Extension` workflow, which validates and packages the extension and creates a **draft** GitHub Release with the ZIP assets. Tag pushes and draft releases do not upload anything to Chrome Web Store.

When ready, open **GitHub → Releases**, edit the draft, review its tag and assets, and click **Publish release**. The `release: published` event starts the `Chrome Web Store` workflow, which checks out that release's tag, validates and builds it, uploads `skill-vault.zip`, waits for upload processing to succeed, and submits it for review. Google publishes the update after approval using the listing's existing distribution settings.

A published GitHub Release created manually or with your own GitHub CLI credentials also triggers store delivery. Published prereleases are included. Editing release notes, updating assets, or saving a draft does not trigger store delivery.

Release publication performed with a workflow's `GITHUB_TOKEN` does not trigger a separate release-event workflow. The draft-first flow avoids that limitation: the build workflow prepares the draft, and a user publishes it from GitHub or the CLI.

The workflow rejects a tag that does not match the manifest version and a version that is not newer than an existing published or submitted revision. Chrome Web Store also validates versions and submission eligibility. The workflow never cancels an existing review. Wait for an active review to finish before attempting another submission.

## Manual checks

Manual runs only read the store status. Uploads and submissions require a published GitHub Release; there is no manual upload or publish bypass. A successful store submission means Google accepted it for processing; it does not mean review has completed.

## Troubleshooting

- **403 / PERMISSION_DENIED:** confirm the JSON key belongs to the service account linked to the correct publisher and that both repository variables identify the intended listing.
- **Version rejected:** increase `public/manifest.json` version and publish a release with a matching tag. Renaming the ZIP does not change the extension version.
- **Listing or privacy errors:** complete the required fields in the Developer Dashboard, including the public privacy-policy URL, and save the draft.
- **Upload timeout:** inspect the package status in the dashboard before retrying; the upload may still be processing.

See Google's documentation for [API usage](https://developer.chrome.com/docs/webstore/using-api) and [service accounts](https://developer.chrome.com/docs/webstore/service-accounts).
