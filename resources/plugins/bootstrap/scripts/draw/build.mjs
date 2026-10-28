import { copyFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { build } from 'esbuild';
import { staticExport } from './src/static.mjs';

await build({
	entryPoints: ['src/browser.mjs'],
	bundle: true,
	minify: true,
	format: 'iife',
	outfile: 'dist/browser.js',
	plugins: [staticExport],
});
await build({
	entryPoints: ['src/index.mjs'],
	bundle: true,
	platform: 'node',
	format: 'esm',
	outfile: 'dist/index.mjs',
});
const require = createRequire(import.meta.url);
copyFileSync(
	join(dirname(require.resolve('@excalidraw/excalidraw')), 'fonts/Virgil/Virgil-Regular.woff2'),
	'dist/virgil.woff2'
);
