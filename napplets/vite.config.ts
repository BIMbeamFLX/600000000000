import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { nip5aManifest } from '@napplet/vite-plugin';
import { fileURLToPath } from 'node:url';

export default defineConfig(({ mode }) => {
  const printer = mode === 'ticket-printer';
  const slug = printer ? 'ticket-printer' : 'raffle-manager';
  return {
    root: printer ? 'ticket-printer' : 'raffle',
    build: { outDir: fileURLToPath(new URL(`./dist/${mode}`, import.meta.url)), emptyOutDir: true, modulePreload: false },
    plugins: [viteSingleFile(), nip5aManifest({
      nappletType: `600b-${mode}`, title: printer ? '600B Ticket Printer' : '600B Raffle',
      description: printer ? 'Print clearly marked raffle previews.' : 'Plan an LNURLcash raffle.',
      artifactMode: 'single-file', requires: [],
      archetypes: [{ slug, convention: `napplet:${slug}/${printer ? 'preview-v1' : 'open-v1'}` }]
    })]
  };
});
