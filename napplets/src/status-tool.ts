// SPDX-License-Identifier: MIT
import { tool, button } from './workspace-ui';
import { el } from './ui';
export function statusTool(kind: 'treasury' | 'fips') {
  const { panel, service, status, run } = tool(kind === 'fips' ? 'Is the path open?' : 'Count the stones.',
    kind === 'fips' ? 'Read the FIPS node status supplied by your host.' : 'Read balances from the authorized treasury source. Planned reserves are not wallet balances.', kind === 'fips' ? 'network-status' : 'treasury-view');
  const content = el('div');
  const refresh = () => run(async () => {
    content.replaceChildren();
    const data = await service!.read() as Record<string, unknown>;
    if (!data || typeof data !== 'object' || typeof data.asOf !== 'string' || !Number.isFinite(Date.parse(data.asOf))) throw Error('Invalid status snapshot.');
    const nodes: HTMLElement[] = [el('p', `Updated: ${data.asOf}`)];
    if (kind === 'fips') {
      if (!['connected', 'disconnected', 'unknown'].includes(String(data.state)) || !Number.isSafeInteger(data.peers) || Number(data.peers) < 0) throw Error('Invalid FIPS status.');
      nodes.push(el('h2', String(data.state)), el('p', `${data.peers} peers`));
    } else {
      if (!Array.isArray(data.assets) || data.assets.length > 100) throw Error('Invalid treasury snapshot.');
      for (const asset of data.assets) {
        if (!asset || typeof asset.label !== 'string' || typeof asset.balanceAtoms !== 'string' || !/^\d{1,30}$/.test(asset.balanceAtoms) || !Number.isInteger(asset.precision) || asset.precision < 0 || asset.precision > 18) throw Error('Invalid asset balance.');
        const digits = asset.balanceAtoms.padStart(asset.precision + 1, '0');
        const amount = asset.precision ? `${digits.slice(0, -asset.precision)}.${digits.slice(-asset.precision)}` : digits;
        nodes.push(el('h2', asset.label), el('p', amount));
      }
    }
    content.replaceChildren(...nodes);
  });
  button(panel, 'Refresh status', !!service, () => void refresh()); panel.append(content);
  if (service) void refresh(); else status.textContent = 'No host status source connected.';
}
