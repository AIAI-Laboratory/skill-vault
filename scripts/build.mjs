import { build } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readReleaseVersion } from './release-version.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const publicDir = path.join(rootDir, 'public');

async function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * Checks whether the current build invocation requests a development build.
 *
 * @param {string[]} [argv] - Command-line arguments passed to the build script.
 * @param {NodeJS.ProcessEnv} [env] - Process environment variables.
 * @returns {boolean} True when `--dev` is passed or `BUILD_MODE` is `dev`.
 */
export function isDevBuild(argv = process.argv.slice(2), env = process.env) {
  return argv.includes('--dev') || env.BUILD_MODE === 'dev';
}

/**
 * Appends a `(dev)` suffix to extension display names in the built manifest so unpacked
 * development builds can be distinguished from release builds in Chrome.
 *
 * @param {string} manifestPath - Absolute path to the built `dist/manifest.json` file.
 */
export function applyDevManifestNaming(manifestPath) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const suffix = ' (dev)';
  if (typeof manifest.name === 'string' && !manifest.name.endsWith(suffix)) {
    manifest.name = `${manifest.name}${suffix}`;
  }
  if (
    manifest.action &&
    typeof manifest.action.default_title === 'string' &&
    !manifest.action.default_title.endsWith(suffix)
  ) {
    manifest.action.default_title = `${manifest.action.default_title}${suffix}`;
  }
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

/**
 * Builds all Skill Vault extension bundles into `dist/` and copies static assets.
 *
 * @param {{ dev?: boolean }} [options] - Optional build mode overrides.
 * @returns {Promise<void>} Resolves once all Vite builds and asset copies complete.
 */
export async function runBuild(options = {}) {
  const devMode = options.dev ?? isDevBuild();
  readReleaseVersion(new URL('../', import.meta.url), process.env.RELEASE_VERSION);
  console.log(
    devMode
      ? 'Building Skill Vault (dev) Chrome Extension...'
      : 'Building Skill Vault Chrome Extension...'
  );

  // 1. Build Side Panel (React SPA)
  console.log('[1/3] Building Side Panel...');
  await build({
    configFile: false,
    plugins: [react(), tailwindcss()],
    root: path.join(rootDir, 'src', 'sidepanel'),
    base: './',
    build: {
      outDir: distDir,
      emptyOutDir: true,
      rollupOptions: {
        input: path.join(rootDir, 'src', 'sidepanel', 'index.html'),
        output: {
          entryFileNames: 'assets/[name]-[hash].js',
          chunkFileNames: 'assets/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash].[ext]',
        },
      },
    },
    resolve: {
      alias: {
        '@': path.join(rootDir, 'src'),
      },
    },
  });

  // Rename dist/index.html to dist/sidepanel.html if needed
  const builtHtml = path.join(distDir, 'index.html');
  const targetHtml = path.join(distDir, 'sidepanel.html');
  if (fs.existsSync(builtHtml)) {
    fs.renameSync(builtHtml, targetHtml);
  }

  // 2. Build Background Service Worker (ES module)
  console.log('[2/3] Building Background Service Worker...');
  await build({
    configFile: false,
    root: rootDir,
    build: {
      outDir: distDir,
      emptyOutDir: false,
      lib: {
        entry: path.join(rootDir, 'src', 'background', 'index.ts'),
        formats: ['es'],
        fileName: () => 'background.js',
      },
    },
    resolve: {
      alias: {
        '@': path.join(rootDir, 'src'),
      },
    },
  });

  // 3. Build Content Script (IIFE for isolated execution)
  console.log('[3/3] Building Content Script...');
  await build({
    configFile: false,
    root: rootDir,
    build: {
      outDir: distDir,
      emptyOutDir: false,
      lib: {
        entry: path.join(rootDir, 'src', 'content', 'index.ts'),
        formats: ['iife'],
        name: 'SkillVaultContent',
        fileName: () => 'content.js',
      },
    },
    resolve: {
      alias: {
        '@': path.join(rootDir, 'src'),
      },
    },
  });

  // 4. Copy static assets from public/ into dist/
  console.log('Copying public assets (manifest, icons)...');
  await copyDir(publicDir, distDir);

  if (devMode) {
    applyDevManifestNaming(path.join(distDir, 'manifest.json'));
    console.log('✓ Skill Vault (dev) build complete in /dist');
  } else {
    console.log('✓ Skill Vault build complete in /dist');
  }
}

const isEntryPoint =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isEntryPoint) {
  runBuild().catch(
    /**
     * Logs a build error and exits with a non-zero status code.
     *
     * @param {unknown} err - Failure thrown during the build pipeline.
     */
    (err) => {
      console.error('Build failed:', err);
      process.exit(1);
    }
  );
}
