import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const packageJsonPath = path.join(rootDir, 'package.json');

const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const rawVersion =
  process.env.RELEASE_VERSION || process.env.GITHUB_REF_NAME || `v${packageJson.version}`;
const cleanVersion = rawVersion.startsWith('v') ? rawVersion : `v${rawVersion}`;

if (!fs.existsSync(distDir) || !fs.existsSync(path.join(distDir, 'manifest.json'))) {
  console.error(
    'Error: dist/ directory or dist/manifest.json does not exist. Please run "npm run build" first.'
  );
  process.exit(1);
}

const versionedZipName = `skill-vault-${cleanVersion}.zip`;
const latestZipName = 'skill-vault.zip';
const versionedZipPath = path.join(rootDir, versionedZipName);
const latestZipPath = path.join(rootDir, latestZipName);

// Clean up previous zip files
if (fs.existsSync(versionedZipPath)) fs.unlinkSync(versionedZipPath);
if (fs.existsSync(latestZipPath)) fs.unlinkSync(latestZipPath);

console.log(`Packaging Skill Vault (${cleanVersion}) into ${versionedZipName}...`);

try {
  if (process.platform === 'win32') {
    execSync(
      `powershell -NoProfile -Command "Compress-Archive -Path '${distDir}/*' -DestinationPath '${versionedZipPath}' -Force"`,
      { stdio: 'inherit' }
    );
  } else {
    execSync(`cd "${distDir}" && zip -r "${versionedZipPath}" . -x "*.DS_Store"`, {
      stdio: 'inherit',
    });
  }

  fs.copyFileSync(versionedZipPath, latestZipPath);

  const stats = fs.statSync(versionedZipPath);
  const sizeMb = (stats.size / (1024 * 1024)).toFixed(2);
  console.log(`✓ Successfully packaged: ${versionedZipName} (${sizeMb} MB) and ${latestZipName}`);
} catch (err) {
  console.error('Packaging failed:', err);
  process.exit(1);
}
