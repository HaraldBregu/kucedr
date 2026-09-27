import { cpSync, createReadStream, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const excalidrawFontsSource = path.resolve(
	import.meta.dirname,
	'./node_modules/@excalidraw/excalidraw/dist/prod/fonts'
);

const excalidrawFonts = {
	name: 'excalidraw-fonts',
	closeBundle() {
		cpSync(excalidrawFontsSource, path.resolve(import.meta.dirname, './dist/fonts'), {
			recursive: true,
		});
	},
	configureServer(server) {
		server.middlewares.use('/fonts', (request, response, next) => {
			const requestPath = decodeURIComponent(request.url ?? '/');
			const fontPath = path.resolve(excalidrawFontsSource, `.${requestPath}`);
			if (
				!fontPath.startsWith(`${excalidrawFontsSource}${path.sep}`) ||
				!existsSync(fontPath) ||
				!statSync(fontPath).isFile()
			) {
				next();
				return;
			}
			response.setHeader('Content-Type', 'font/woff2');
			createReadStream(fontPath).pipe(response);
		});
	},
};

export default defineConfig({
	base: './',
	build: {
		assetsInlineLimit: (filePath) => /[/\\]@tldraw[/\\]assets[/\\]/.test(filePath),
	},
	plugins: [react(), excalidrawFonts],
	publicDir: false,
	resolve: {
		alias: {
			'@': path.resolve(import.meta.dirname, './src'),
			'@kucedr/sdk': path.resolve(import.meta.dirname, '../../../packages/sdk/index.ts'),
		},
	},
});
