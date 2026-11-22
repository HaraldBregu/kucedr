import base from './electron.vite.config';

const out = (name: string) => `out-verify/app/out/${name}`;

export default {
	...base,
	main: {
		...base.main,
		plugins: base.main.plugins.filter((plugin) => plugin?.name !== 'bootstrap-scripts'),
		build: { ...base.main.build, outDir: out('main') },
	},
	preload: { ...base.preload, build: { ...base.preload.build, outDir: out('preload') } },
	renderer: { ...base.renderer, build: { ...base.renderer.build, outDir: out('renderer') } },
};
