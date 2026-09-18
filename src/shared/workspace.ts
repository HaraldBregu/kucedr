const ASSET_MIME_TYPES: Record<string, string> = {
	aac: 'audio/aac',
	avif: 'image/avif',
	bmp: 'image/bmp',
	flac: 'audio/flac',
	gif: 'image/gif',
	ico: 'image/x-icon',
	jpeg: 'image/jpeg',
	jpg: 'image/jpeg',
	m4a: 'audio/mp4',
	m4v: 'video/x-m4v',
	mov: 'video/quicktime',
	mp3: 'audio/mpeg',
	mp4: 'video/mp4',
	oga: 'audio/ogg',
	ogg: 'audio/ogg',
	ogv: 'video/ogg',
	opus: 'audio/ogg',
	pdf: 'application/pdf',
	png: 'image/png',
	svg: 'image/svg+xml',
	wav: 'audio/wav',
	webm: 'video/webm',
	webp: 'image/webp',
};

const MARKDOWN_EXTENSIONS = new Set(['md', 'markdown']);
const MERMAID_EXTENSIONS = new Set(['mermaid', 'mmd']);
const TEXT_EXTENSIONS = new Set([
	'c',
	'conf',
	'cpp',
	'css',
	'csv',
	'gitignore',
	'go',
	'h',
	'html',
	'ini',
	'java',
	'js',
	'json',
	'jsx',
	'log',
	'mjs',
	'py',
	'rs',
	'sh',
	'sql',
	'toml',
	'ts',
	'tsv',
	'tsx',
	'txt',
	'xml',
	'yaml',
	'yml',
]);
const TEXT_FILENAMES = new Set(['dockerfile', 'license', 'makefile', 'readme']);
const BINARY_EXTENSIONS = new Set([
	'7z',
	'bin',
	'dmg',
	'doc',
	'docx',
	'exe',
	'gz',
	'jar',
	'rar',
	'tar',
	'wasm',
	'xls',
	'xlsx',
	'zip',
]);

export type WorkspaceFileKind =
	| 'markdown'
	| 'mermaid'
	| 'excalidraw'
	| 'tldraw'
	| 'text'
	| 'image'
	| 'audio'
	| 'video'
	| 'pdf'
	| 'unsupported';

export interface WorkspaceFileType {
	kind: WorkspaceFileKind;
	mimeType?: string;
}

export interface WorkspaceAsset {
	mimeType: string;
	data: Uint8Array;
}

export function workspaceFileType(filePath: string): WorkspaceFileType {
	const name = filePath.split(/[\\/]/).pop()?.toLowerCase() ?? '';
	const extension = name.includes('.') ? (name.split('.').pop() ?? '') : '';
	const mimeType = ASSET_MIME_TYPES[extension];
	if (mimeType === 'application/pdf') return { kind: 'pdf', mimeType };
	if (mimeType?.startsWith('image/')) return { kind: 'image', mimeType };
	if (mimeType?.startsWith('audio/')) return { kind: 'audio', mimeType };
	if (mimeType?.startsWith('video/')) return { kind: 'video', mimeType };
	if (MARKDOWN_EXTENSIONS.has(extension)) return { kind: 'markdown', mimeType: 'text/markdown' };
	if (MERMAID_EXTENSIONS.has(extension)) return { kind: 'mermaid', mimeType: 'text/vnd.mermaid' };
	if (name.endsWith('.excalidraw') || name.endsWith('.excalidraw.json')) {
		return { kind: 'excalidraw', mimeType: 'application/vnd.excalidraw+json' };
	}
	if (extension === 'tldr' || extension === 'tldraw') {
		return { kind: 'tldraw', mimeType: 'application/vnd.tldraw+json' };
	}
	if (!BINARY_EXTENSIONS.has(extension) || TEXT_EXTENSIONS.has(extension) || TEXT_FILENAMES.has(name))
		return { kind: 'text', mimeType: 'text/plain' };
	return { kind: 'unsupported' };
}
