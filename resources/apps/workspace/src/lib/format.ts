export const formatOptions = [
	{ value: 'json', label: 'JSON' },
	{ value: 'jsonc', label: 'JSONC' },
	{ value: 'json5', label: 'JSON5' },
	{ value: 'javascript', label: 'JavaScript / JSX' },
	{ value: 'typescript', label: 'TypeScript / TSX' },
	{ value: 'python', label: 'Python' },
	{ value: 'css', label: 'CSS' },
	{ value: 'scss', label: 'SCSS' },
	{ value: 'less', label: 'Less' },
	{ value: 'html', label: 'HTML' },
	{ value: 'vue', label: 'Vue' },
	{ value: 'markdown', label: 'Markdown' },
	{ value: 'mdx', label: 'MDX' },
	{ value: 'yaml', label: 'YAML' },
	{ value: 'graphql', label: 'GraphQL' },
] as const;

export type FormatType = (typeof formatOptions)[number]['value'];

export async function formatFile(format: FormatType, content: string): Promise<string> {
	if (format === 'python') {
		const { default: init, PositionEncoding, Workspace } = await import('@astral-sh/ruff-wasm-web');
		await init();
		const workspace = new Workspace({}, PositionEncoding.Utf16);
		try {
			return workspace.format(content);
		} finally {
			workspace.free();
		}
	}

	const prettier = await import('prettier/standalone');
	switch (format) {
		case 'javascript':
			return prettier.format(content, {
				parser: 'babel',
				plugins: [await import('prettier/plugins/babel'), await import('prettier/plugins/estree')],
			});
		case 'typescript':
			return prettier.format(content, {
				parser: 'typescript',
				plugins: [await import('prettier/plugins/typescript'), await import('prettier/plugins/estree')],
			});
		case 'json':
		case 'jsonc':
		case 'json5':
			return prettier.format(content, {
				parser: format,
				plugins: [await import('prettier/plugins/babel'), await import('prettier/plugins/estree')],
			});
		case 'css':
		case 'scss':
		case 'less':
			return prettier.format(content, {
				parser: format,
				plugins: [await import('prettier/plugins/postcss')],
			});
		case 'html':
		case 'vue':
			return prettier.format(content, {
				parser: format,
				plugins: [
					await import('prettier/plugins/html'),
					await import('prettier/plugins/babel'),
					await import('prettier/plugins/estree'),
					await import('prettier/plugins/typescript'),
					await import('prettier/plugins/postcss'),
				],
			});
		case 'markdown':
		case 'mdx':
			return prettier.format(content, {
				parser: format,
				plugins: [
					await import('prettier/plugins/markdown'),
					await import('prettier/plugins/babel'),
					await import('prettier/plugins/estree'),
					await import('prettier/plugins/typescript'),
					await import('prettier/plugins/html'),
					await import('prettier/plugins/postcss'),
				],
			});
		case 'yaml':
			return prettier.format(content, {
				parser: 'yaml',
				plugins: [await import('prettier/plugins/yaml')],
			});
		case 'graphql':
			return prettier.format(content, {
				parser: 'graphql',
				plugins: [await import('prettier/plugins/graphql')],
			});
		default:
			throw new Error('Formatting is not available for this file type.');
	}
}
