# Chrome Web Store CI/CD

The `Chrome Web Store` GitHub Actions workflow uses the Chrome Web Store API v2 to update the existing Skill Vault listing. The separate `Release Extension` workflow continues to create GitHub release ZIP files.

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

Open **Actions → Chrome Web Store → Run workflow**, leave `operation` set to `status`, and run against `main`. This authenticates, reads the listing status, and writes a job summary. It does not upload, submit, cancel a review, or publish anything.

Using the GitHub CLI:

```bash
gh workflow run chrome-web-store.yml --ref main -f operation=status
```

## Release a new version

Increase `version` in `public/manifest.json` and `package.json`, commit the release changes, and push them. The tag must exactly match the manifest version:

```bash
git tag v0.1.2
git push origin v0.1.2
```

Pushing a `v*` tag runs dependency installation, formatting, linting, typechecking, tests, and packaging. After those checks pass, the workflow uploads `skill-vault.zip`, waits for upload processing to succeed, and submits it for review. Google publishes the update after approval using the listing's existing distribution settings.

The workflow rejects a tag that does not match the manifest version and a version that is not newer than an existing published or submitted revision. Chrome Web Store also validates versions and submission eligibility. The workflow never cancels an existing review. Wait for an active review to finish before attempting another submission.

## Manual uploads and submissions

When running the workflow manually, choose:

- `status`: read the listing status only; this is the default.
- `upload`: validate, build, and upload a new draft package without submitting it.
- `publish`: validate, build, upload, and submit the package for review.

For `upload` and `publish`, run from a trusted branch or tag containing the intended extension version. A successful submission means Google accepted it for processing; it does not mean review has completed.

## Troubleshooting

- **403 / PERMISSION_DENIED:** confirm the JSON key belongs to the service account linked to the correct publisher and that both repository variables identify the intended listing.
- **Version rejected:** increase `public/manifest.json` version and use a matching release tag. Renaming the ZIP does not change the extension version.
- **Listing or privacy errors:** complete the required fields in the Developer Dashboard, including the public privacy-policy URL, and save the draft.
- **Upload timeout:** inspect the package status in the dashboard before retrying; the upload may still be processing.

See Google's documentation for [API usage](https://developer.chrome.com/docs/webstore/using-api) and [service accounts](https://developer.chrome.com/docs/webstore/service-accounts).
