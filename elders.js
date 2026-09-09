// SPDX-License-Identifier: MIT
(() => {
    'use strict';
    const connect = document.getElementById('connect');
    const disconnect = document.getElementById('disconnect');
    const connection = document.getElementById('connection');
    const publicKey = document.getElementById('public-key');
    const status = document.getElementById('connection-status');
    const list = document.getElementById('founder-list');
    let founders = [];

    fetch('data/elders-2026-09-09.json')
        .then(response => {
            if (!response.ok) throw new Error('Roster unavailable');
            return response.json();
        })
        .then(roster => {
            const entries = roster.founders;
            if (!Array.isArray(entries) || entries.length !== 30
                || entries.some(entry => typeof entry.id !== 'string'
                    || typeof entry.name !== 'string'
                    || (entry.pubkey !== null && (typeof entry.pubkey !== 'string'
                        || !/^[0-9a-f]{64}$/.test(entry.pubkey))))) {
                throw new Error('Invalid founding roster');
            }
            const keys = entries.filter(entry => entry.pubkey !== null).map(entry => entry.pubkey);
            if (new Set(keys).size !== keys.length
                || new Set(entries.map(entry => entry.id)).size !== 30) {
                throw new Error('Duplicate founding identity');
            }
            founders = entries;
            for (const [index, founder] of founders.entries()) {
                const item = document.createElement('li');
                const name = document.createElement('span');
                const state = document.createElement('span');
                name.className = 'founder-name';
                name.textContent = `${String(index + 1).padStart(2, '0')} / ${founder.name}`;
                state.className = 'founder-state';
                state.textContent = founder.pubkey ? 'Founding key recorded' : 'Key confirmation pending';
                if (!founder.pubkey) item.className = 'pending';
                item.append(name, state);
                list.append(item);
            }
            const pending = founders.filter(founder => !founder.pubkey).length;
            document.getElementById('roster-note').textContent = `${founders.length} founding slots. `
                + `${pending} ${pending === 1 ? 'key confirmation' : 'key confirmations'} pending. `
                + 'Every founding allocation stays reserved.';
            status.textContent = 'Check whether your Nostr key matches the fixed founding roster.';
            connect.disabled = false;
        })
        .catch(() => {
            status.textContent = 'The founding roster could not be verified. Key checks and claims '
                + 'are closed. Please reload to try again.';
        });

    connect.addEventListener('click', async () => {
        const signer = window.nostr;
        if (!signer || typeof signer.getPublicKey !== 'function'
            || typeof signer.signEvent !== 'function') {
            status.textContent = 'Enable a NIP-07 browser signer, then try again. '
                + 'Never paste a private key into this page.';
            return;
        }
        connect.disabled = true;
        connect.setAttribute('aria-busy', 'true');
        status.textContent = 'Check your Nostr signer to allow this connection.';
        try {
            const key = await signer.getPublicKey();
            if (typeof key !== 'string' || !/^[0-9a-f]{64}$/i.test(key)) {
                throw new Error('Invalid public key');
            }
            const normalized = key.toLowerCase();
            const founder = founders.find(entry => entry.pubkey === normalized);
            publicKey.textContent = normalized;
            connection.hidden = false;
            connect.hidden = true;
            status.textContent = founder
                ? `${founder.name}, your key matches the founding roster. Your planned allocation `
                    + 'is 21 whole 600 tokens. This is a local match only; signed verification '
                    + 'and payouts are not open yet.'
                : 'This key is not on the recorded founding list. This desk is for the original '
                    + '30 only. If your key is still pending, your allocation stays reserved.';
            disconnect.focus();
        } catch {
            status.textContent = 'The connection did not complete. No allocation was claimed. '
                + 'You can try again.';
        } finally {
            connect.disabled = false;
            connect.removeAttribute('aria-busy');
        }
    });
    disconnect.addEventListener('click', () => {
        publicKey.textContent = '';
        connection.hidden = true;
        connect.hidden = false;
        status.textContent = 'Disconnected from this page. No allocation has been claimed.';
        connect.focus();
    });
})();
