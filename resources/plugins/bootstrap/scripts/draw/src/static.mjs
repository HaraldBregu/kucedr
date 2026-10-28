export const staticExport = {
	name: 'static-export',
	setup(build) {
		build.onResolve({ filter: /.*/ }, (args) =>
			args.kind === 'dynamic-import' ? { path: args.path, external: true } : undefined
		);
	},
};
