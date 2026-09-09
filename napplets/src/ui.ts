// SPDX-License-Identifier: MIT
import './style.css';
export const embedded = window.parent !== window;
export const number = (value: number): string => value.toLocaleString('en-US');
/** Build DOM nodes without interpreting user-controlled HTML. */
export function el<K extends keyof HTMLElementTagNameMap>(tag: K, text = '', cls = ''): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag); node.textContent = text; node.className = cls; return node;
}
/** Render the shared frame while keeping each tool independently bootable. */
export function frame(title: string, intro: string): HTMLElement {
  const app = document.querySelector<HTMLElement>('#app')!;
  app.innerHTML = '<header><strong>600<span>.wtf</span></strong><span>THE GUILD TOOLBOX / PREVIEW</span></header>';
  app.append(el('p', 'ONE FUNCTION. ONE NAPPLET.', 'eyebrow'), el('h1', title), el('p', intro, 'intro'));
  return app;
}
/** Download only generated non-spendable previews in a standalone browser. */
export function download(bytes: BlobPart, filename: string, type: string): void {
  if (embedded) throw Error('Open this preview standalone to export. Host export is not connected.');
  const url = URL.createObjectURL(new Blob([bytes], { type }));
  const link = el('a'); link.href = url; link.download = filename; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
export function footer(app: HTMLElement): void {
  const foot = el('footer'); foot.append(el('span', 'Built with dni’s LNURLcash raffle. Still not a cult.'));
  if (!embedded) { const link = el('a', 'Back to the guild'); link.href = '../../../pebbles.html#guild'; foot.append(link); }
  app.append(foot);
}
