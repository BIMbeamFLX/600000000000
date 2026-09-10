// SPDX-License-Identifier: MIT
import { inc } from '@napplet/sdk';
import { el, embedded, frame } from './ui';

export type Row = Record<string, unknown>;
type GuildService = { read(): Promise<unknown>; command(request: Row): Promise<unknown>; group(request: Row): Promise<unknown>; cancel(request: Row): Promise<unknown> };
/** Shared presentation only. Each bundle has its own entrypoint and host-granted capability. */
export function tool(title: string, intro: string, slug: string) {
  const app = frame(title, intro);
  const host = embedded ? (window as unknown as { napplet?: { guild?: GuildService } }).napplet?.guild : undefined;
  // Retain a command ID after a transport error. A retry of the same input is not a new mutation.
  const pendingCommands = new Map<string, Row>();
  const service: GuildService | undefined = host ? {
    read: () => host.read(), group: request => host.group(request), cancel: request => host.cancel(request),
    command: async request => {
      const key = JSON.stringify([request.action, request.input]);
      const pending = pendingCommands.get(key) ?? request; pendingCommands.set(key, pending);
      const result = await host.command(pending); pendingCommands.delete(key); return result;
    },
  } : undefined;
  const status = el('p', service ? 'Loading host data…' : 'Open in the guild workspace to use this tool.', 'status'); status.setAttribute('role', 'status'); app.append(status);
  const panel = el('section', '', 'panel'); app.append(panel);
  let busy = false;
  let active = true;
  const run = async (operation: () => Promise<unknown>) => {
    if (busy || !active) return;
    busy = true;
    try { const result = await operation(); if (active) status.textContent = typeof result === 'string' ? result : 'Completed by the host.'; return result; }
    catch (error) { if (active) status.textContent = (error as Error).message; }
    finally { busy = false; }
  };
  if (embedded) {
    try {
      const subscription = inc.on(`napplet:${slug}/open-v1`, event => {
        const context = event.payload as Row;
        // This workspace version advertises a guild-only navigation context.
        if (!context || Object.keys(context).sort().join(',') !== 'guildId,version' || context.version !== 1 || context.guildId !== '600b')
          status.textContent = 'Navigation rejected: unsupported guild or context.';
      });
      window.addEventListener('pagehide', () => { active = false; subscription.close(); }, { once: true });
    } catch { /* Host UI can still mount directly without optional INC. */ }
  }
  return { app, panel, service, status, run };
}
export function field(panel: HTMLElement, title: string, type = 'text') {
  const label = el('label', title); const input = el('input'); input.type = type; input.maxLength = 160; label.append(input); panel.append(label); return input;
}
export function button(panel: HTMLElement, title: string, enabled: boolean, action: () => void) {
  const node = el('button', title); node.disabled = !enabled; node.onclick = action; panel.append(node); return node;
}
/** Render plain host data as safe text without HTML or hidden capability fields. */
export function rows(parent: HTMLElement, values: unknown, format: (row: Row, node: HTMLElement) => void) {
  if (!Array.isArray(values) || values.length > 2000) throw Error('Invalid host collection.');
  parent.replaceChildren();
  for (const row of values) {
    if (!row || typeof row !== 'object') throw Error('Invalid host row.');
    const card = el('article'); card.style.cssText = 'border-top:1px dashed;padding:16px 0;overflow-wrap:anywhere';
    format(row as Row, card); parent.append(card);
  }
  if (!values.length) parent.append(el('p', 'Nothing recorded yet.'));
}
