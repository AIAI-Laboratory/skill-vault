import fs from 'node:fs';
import { versionParts } from './release-version.mjs';

const root = new URL('../', import.meta.url);
const { version } = JSON.parse(fs.readFileSync(new URL('package.json', root), 'utf8'));
versionParts(version);
const manifestPath = new URL('public/manifest.json', root);
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
// Preserve formatting of the template; npm version also updates package-lock.json.
const source = fs.readFileSync(manifestPath, 'utf8');
manifest.version = version;
fs.writeFileSync(
  manifestPath,
  source.replace(/("version"\s*:\s*)"[^"]*"/, `$1"${manifest.version}"`)
);
