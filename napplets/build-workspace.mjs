// SPDX-License-Identifier: MIT
import { build } from 'vite';
import { workspaceTools } from './workspace-tools.mjs';
for (const mode of Object.keys(workspaceTools)) await build({ mode });
