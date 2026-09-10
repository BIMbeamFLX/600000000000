import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { nip5aManifest } from '@napplet/vite-plugin';
import { fileURLToPath } from 'node:url';
import { directoryDefines } from './directory-data.ts';
import { workspaceTools } from './workspace-tools.mjs';

export default defineConfig(({ mode }) => {
  const printer = mode === 'ticket-printer';
  const directory = mode === 'member-directory';
  const recovery = mode === 'key-recovery';
  const workspace = Object.hasOwn(workspaceTools, mode) ? workspaceTools[mode as keyof typeof workspaceTools] : undefined;
  if (!workspace && !['raffle', 'ticket-printer', 'member-directory', 'key-recovery'].includes(mode)) throw Error('Unknown napplet build mode.');
  const slug = workspace?.slug ?? (recovery ? 'key-recovery' : directory ? 'member-directory' : printer ? 'ticket-printer' : 'raffle-manager');
  return {
    define: directory ? directoryDefines : {},
    root: mode,
    build: { outDir: fileURLToPath(new URL(`./dist/${mode}`, import.meta.url)), emptyOutDir: true, modulePreload: false },
    plugins: [viteSingleFile(), nip5aManifest({
      nappletType: `600b-${mode}`, title: workspace?.title ?? (recovery ? '600B Avatar Recovery' : directory ? '600B Member Directory' : printer ? '600B Ticket Printer' : '600B Raffle'),
      description: workspace?.description ?? (recovery ? 'Review avatar key changes through an authorized recovery host.' : directory ? 'Browse the public founding member snapshot.' : printer ? 'Print clearly marked raffle previews.' : 'Plan an LNURLcash raffle.'),
      artifactMode: 'single-file', requires: [],
      archetypes: [{ slug, convention: `napplet:${slug}/${printer ? 'preview-v1' : 'open-v1'}` }]
    })]
  };
});
