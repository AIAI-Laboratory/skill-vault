import { beforeAll, describe, expect, it } from 'vitest';
import { build } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';
import { renderToStaticMarkup } from 'react-dom/server';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../src/components/ui/tabs';

let css: string;

beforeAll(async () => {
  // Use the extension build's nested root: scanning only the sidepanel previously
  // omitted shared component styles even though the build succeeded.
  const result = await build({
    configFile: false,
    root: fileURLToPath(new URL('../../src/sidepanel', import.meta.url)),
    publicDir: false,
    logLevel: 'silent',
    plugins: [tailwindcss()],
    build: {
      write: false,
      cssMinify: true,
      rollupOptions: {
        input: fileURLToPath(new URL('../../src/index.css', import.meta.url)),
      },
    },
  });
  if (!('output' in result)) throw new Error('Expected a single CSS build output');
  const asset = result.output.find(
    (item) => item.type === 'asset' && item.fileName.endsWith('.css')
  );
  if (!asset || asset.type !== 'asset') throw new Error('Sidepanel CSS was not emitted');
  css = String(asset.source);
}, 15_000);

describe('sidepanel production styles', () => {
  it('matches the orientation attributes emitted by Base UI', () => {
    const markup = renderToStaticMarkup(
      <Tabs defaultValue="vault">
        <TabsList>
          <TabsTrigger value="vault">Vault</TabsTrigger>
        </TabsList>
        <TabsContent value="vault">Skills</TabsContent>
      </Tabs>
    );
    expect(markup).toContain('data-orientation="horizontal"');
    // Checking only that "data-horizontal" exists misses the broken selector
    // [data-horizontal], which never matches Base UI's rendered DOM.
    expect(css).toContain(
      '.data-horizontal\\:flex-col:where([data-orientation=horizontal]){flex-direction:column}'
    );
    expect(css).toContain(
      '.group-data-horizontal\\/tabs\\:h-8:is(:where(.group\\/tabs):where([data-orientation=horizontal]) *)'
    );
    expect(css).toContain(
      '.data-horizontal\\:h-px:where([data-orientation=horizontal]){height:1px}'
    );
  });

  it('forwards the vertical orientation to the primitive', () => {
    const markup = renderToStaticMarkup(
      <Tabs orientation="vertical" defaultValue="vault">
        <TabsList>
          <TabsTrigger value="vault">Vault</TabsTrigger>
        </TabsList>
      </Tabs>
    );
    expect(markup).toContain('data-orientation="vertical"');
    expect(markup).not.toContain('data-orientation="horizontal"');
  });

  it('ships the shared button and card utilities in the extension stylesheet', () => {
    expect(css).toContain('.inline-flex{display:inline-flex}');
    expect(css).toContain('.bg-card{background-color:var(--card)}');
    expect(css).toContain('.gap-\\(--card-spacing\\){gap:var(--card-spacing)}');
    expect(css).toContain('.px-2\\.5{padding-inline:calc(var(--spacing) * 2.5)}');
    expect(css).toContain('.h-8{height:calc(var(--spacing) * 8)}');
  });
});
