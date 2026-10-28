import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const script = fileURLToPath(new URL('../dist/index.mjs', import.meta.url));

// POST /run with { input, theme }: pipes it into the built script, the way the host runs it,
// and answers with its HTML (200) or its error message (400).
const run = {
	name: 'run-dither-script',
	configureServer(server) {
		server.middlewares.use('/run', (req, res) => {
			const child = spawn(process.execPath, [script]);
			let out = '';
			let err = '';
			child.stdout.on('data', (chunk) => (out += chunk));
			child.stderr.on('data', (chunk) => (err += chunk));
			child.on('close', (code) => {
				res.statusCode = code === 0 ? 200 : 400;
				res.setHeader('content-type', code === 0 ? 'text/html' : 'text/plain');
				res.end(code === 0 ? out : err);
			});
			req.pipe(child.stdin);
		});
	},
};

export default defineConfig({
	root: fileURLToPath(new URL('.', import.meta.url)),
	// Keep Vite's cache out of the plugin folder, which must not hold node_modules.
	cacheDir: fileURLToPath(new URL('../../../../../node_modules/.vite/dither', import.meta.url)),
	plugins: [react(), run],
});
