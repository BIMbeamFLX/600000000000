import { defineConfig } from 'vitest/config';
import { directoryDefines } from './directory-data.ts';
export default defineConfig({ define: directoryDefines, test: { include: ['src/**/*.test.ts', 'vendor/**/*.test.ts'] } });
