// SPDX-License-Identifier: MIT
(() => {
    'use strict';

    const connect = document.getElementById('connect');
    const disconnect = document.getElementById('disconnect');
    const connection = document.getElementById('connection');
    const publicKey = document.getElementById('public-key');
    const status = document.getElementById('connection-status');

    connect.disabled = false;

    connect.addEventListener('click', async () => {
        const signer = window.nostr;
        if (!signer || typeof signer.getPublicKey !== 'function'
            || typeof signer.signEvent !== 'function') {
            status.textContent = 'No Nostr signer found. Enable a NIP-07 signer in your browser, '
                + 'then try again. Never paste your private key here.';
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
            publicKey.textContent = key.toLowerCase();
            connection.hidden = false;
            connect.hidden = true;
            status.textContent = 'Nostr connected. You’re at the welcome desk. '
                + 'Membership and token claims open when the faucet is ready.';
            disconnect.focus();
        } catch {
            status.textContent = 'Connection didn’t complete. Nothing was claimed or registered. '
                + 'You can try again when you’re ready.';
        } finally {
            connect.disabled = false;
            connect.removeAttribute('aria-busy');
        }
    });

    disconnect.addEventListener('click', () => {
        publicKey.textContent = '';
        connection.hidden = true;
        connect.hidden = false;
        status.textContent = 'Disconnected from this page. Your signer’s permissions are managed '
            + 'in the signer itself.';
        connect.focus();
    });
})();
