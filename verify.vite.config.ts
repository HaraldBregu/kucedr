import { resolve } from 'path';
import base from './electron.vite.config';

const config = base as unknown as {
	main: { plugins: { name?: string }[]; build: Record<string, unknown> };
	preload: { build: Record<string, unknown> };
	renderer: { build?: Record<string, unknown> };
};
config.main.plugins = config.main.plugins.filter((plugin) => plugin?.name !== 'bootstrap-scripts');
config.main.build = { ...config.main.build, outDir: resolve(__dirname, 'out-verify/app/out/main') };
config.preload.build = { ...config.preload.build, outDir: resolve(__dirname, 'out-verify/app/out/preload') };
config.renderer.build = { ...config.renderer.build, outDir: resolve(__dirname, 'out-verify/app/out/renderer') };
export default config;
