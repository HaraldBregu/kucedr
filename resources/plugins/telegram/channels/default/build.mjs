import { build } from 'esbuild';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const directory = dirname(fileURLToPath(import.meta.url));

await build({
	entryPoints: [join(directory, 'source.cjs')],
	outfile: join(directory, 'index.cjs'),
	bundle: true,
	platform: 'node',
	format: 'cjs',
	target: 'node20',
});
