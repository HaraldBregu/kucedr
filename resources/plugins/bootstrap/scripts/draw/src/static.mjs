export const staticExport = {
	name: 'static-export',
	setup(build) {
		build.onResolve({ filter: /.*/ }, (args) =>
			args.kind === 'dynamic-import' && !/[\\/]browser-fs-access[\\/]/.test(args.importer)
				? { path: args.path, external: true }
				: undefined
		);
	},
};
