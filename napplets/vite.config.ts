import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { nip5aManifest } from '@napplet/vite-plugin';
import { fileURLToPath } from 'node:url';
import { directoryDefines } from './directory-data.ts';

export default defineConfig(({ mode }) => {
  const printer = mode === 'ticket-printer';
  const directory = mode === 'member-directory';
  const recovery = mode === 'key-recovery';
  if (!['raffle', 'ticket-printer', 'member-directory', 'key-recovery'].includes(mode)) throw Error('Unknown napplet build mode.');
  const slug = recovery ? 'key-recovery' : directory ? 'member-directory' : printer ? 'ticket-printer' : 'raffle-manager';
  return {
    define: directory ? directoryDefines : {},
    root: mode,
    build: { outDir: fileURLToPath(new URL(`./dist/${mode}`, import.meta.url)), emptyOutDir: true, modulePreload: false },
    plugins: [viteSingleFile(), nip5aManifest({
      nappletType: `600b-${mode}`, title: recovery ? '600B Avatar Recovery' : directory ? '600B Member Directory' : printer ? '600B Ticket Printer' : '600B Raffle',
      description: recovery ? 'Review avatar key changes through an authorized recovery host.' : directory ? 'Browse the public founding member snapshot.' : printer ? 'Print clearly marked raffle previews.' : 'Plan an LNURLcash raffle.',
      artifactMode: 'single-file', requires: [],
      archetypes: [{ slug, convention: `napplet:${slug}/${printer ? 'preview-v1' : 'open-v1'}` }]
    })]
  };
});
