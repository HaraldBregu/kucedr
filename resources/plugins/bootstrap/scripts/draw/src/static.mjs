export const staticExport = {
	name: 'static-export',
	setup(build) {
		build.onResolve({ filter: /.*/ }, (args) =>
			args.kind === 'dynamic-import' && !args.importer.includes('/browser-fs-access/')
				? { path: args.path, external: true }
				: undefined
		);
	},
};
