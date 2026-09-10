import { resolve } from 'path';
import { tmpdir } from 'os';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';
import pkg from './package.json';

export default defineConfig({
	main: {
		envPrefix: ['MAIN_VITE_', 'VITE_'],
		plugins: [externalizeDepsPlugin()],
		build: {
			rollupOptions: {
				input: {
					index: resolve(__dirname, 'src/main/index.ts'),
				},
				output: {
					entryFileNames: '[name].js',
				},
			},
		},
	},
	preload: {
		plugins: [externalizeDepsPlugin()],
		build: {
			target: 'node22',
			rollupOptions: {
				output: {
					format: 'cjs',
					entryFileNames: '[name].js',
				},
			},
		},
	},
	renderer: {
		// Keep Vite's dep pre-bundling cache outside the OneDrive-synced project
		// tree, otherwise OneDrive locks node_modules/.vite/deps files and Vite
		// fails to unlink them on startup (EBUSY: resource busy or locked).
		cacheDir: resolve(tmpdir(), 'kucedr-vite-cache'),
		publicDir: resolve(__dirname, './src/renderer/public'),
		resolve: {
			alias: {
				'@': resolve(__dirname, './src/renderer/src'),
				'@utils': resolve(__dirname, './src/renderer/src/utils'),
				'@pages': resolve(__dirname, './src/renderer/src/pages'),
				'@store': resolve(__dirname, './src/renderer/src/store'),
				'@components': resolve(__dirname, './src/renderer/src/components'),
				'@icons': resolve(__dirname, './src/renderer/src/components/icons'),
				'@shared': resolve(__dirname, './src/shared'),
				'@resources': resolve(__dirname, 'resources'),
			},
		},
		define: {
			__APP_NAME__: JSON.stringify(pkg.productName),
			__APP_VERSION__: JSON.stringify(pkg.version),
			__APP_AUTHOR__: JSON.stringify(pkg.author),
			__APP_HOMEPAGE__: JSON.stringify(pkg.homepage),
			__APP_LICENSE__: JSON.stringify(pkg.license),
		},
		plugins: [
			react({ exclude: [/\/node_modules\//, /\/kucedr-vite-cache\/deps\//] }),
			tsconfigPaths({ ignoreConfigErrors: true }),
			{
				// react-video-audio-player ships Tailwind v3 CSS whose unlayered
				// `*, :before, :after { --tw-*: 0 }` reset overrides the app's
				// layered Tailwind v4 utilities. Demote it to the lowest layer.
				name: 'vendor-css-layer',
				enforce: 'pre',
				transform(code, id) {
					if (id.includes('react-video-audio-player') && id.endsWith('.css')) {
						return { code: `@layer vendor {\n${code}\n}`, map: null };
					}
					return null;
				},
			},
		],
		build: {
			rollupOptions: {
				input: {
					index: resolve(__dirname, 'src/renderer/index.html'),
					app: resolve(__dirname, 'src/renderer/app.html'),
					voice: resolve(__dirname, 'src/renderer/voice.html'),
				},
			},
		},
	},
});
