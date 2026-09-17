import { build } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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

async function runBuild() {
  console.log('Building Skill Vault Chrome Extension...');

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

  console.log('✓ Skill Vault build complete in /dist');
}

runBuild().catch((err) => {
  console.error('Build failed:', err);
  process.exit(1);
});
