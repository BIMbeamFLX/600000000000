import { defineConfig, type Plugin } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { nip5aManifest } from '@napplet/vite-plugin';
import { fileURLToPath } from 'node:url';

/** Stamp the napplet type and the shell domains its code uses into the built HTML head. */
function nappletMeta(type: string, requires: string[]): Plugin {
  return {
    name: 'napplet-meta',
    transformIndexHtml: () => [
      { tag: 'meta', attrs: { name: 'napplet-type', content: type }, injectTo: 'head-prepend' },
      { tag: 'meta', attrs: { name: 'napplet-requires', content: requires.join(',') }, injectTo: 'head-prepend' }
    ]
  };
}

export default defineConfig(({ mode }) => {
  const printer = mode === 'ticket-printer';
  const slug = printer ? 'ticket-printer' : 'raffle-manager';
  const nappletType = `600b-${mode}`;
  // The printer only listens on inc; the planner also resolves the printer through intent.
  const requires = printer ? ['inc'] : ['inc', 'intent'];
  return {
    root: printer ? 'ticket-printer' : 'raffle',
    build: { outDir: fileURLToPath(new URL(`./dist/${mode}`, import.meta.url)), emptyOutDir: true, modulePreload: false },
    plugins: [viteSingleFile(), nappletMeta(nappletType, requires), nip5aManifest({
      nappletType, title: printer ? '600B Ticket Printer' : '600B Raffle',
      description: printer ? 'Print clearly marked raffle previews.' : 'Plan an LNURLcash raffle.',
      artifactMode: 'single-file', requires,
      archetypes: [{ slug, convention: `napplet:${slug}/${printer ? 'preview-v1' : 'open-v1'}` }]
    })]
  };
});
