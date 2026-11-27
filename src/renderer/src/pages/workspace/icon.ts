import { File, FileArchive, FileBox, FileBraces, FileChartPie, FileCode, FileCog, FileImage, FileKey, FileLock, FileMusic, FilePenLine, FileSpreadsheet, FileTerminal, FileText, FileType, FileVideo, type LucideIcon } from 'lucide-react';
import { workspaceFileType } from '@shared/workspace';

const groups: [LucideIcon, string[]][] = [
	[FileBraces, ['json', 'jsonc', 'json5', 'jsonl', 'ndjson', 'geojson']],
	[FileCode, ['c', 'cc', 'cpp', 'cs', 'css', 'dart', 'go', 'h', 'hpp', 'html', 'java', 'js', 'jsx', 'kt', 'less', 'lua', 'mjs', 'cjs', 'php', 'py', 'rb', 'rs', 'sass', 'scss', 'sql', 'svelte', 'swift', 'ts', 'tsx', 'vue', 'xml']],
	[FileTerminal, ['sh', 'bash', 'zsh', 'fish', 'ps1', 'bat', 'cmd']],
	[FileCog, ['conf', 'cfg', 'ini', 'toml', 'yaml', 'yml', 'env', 'properties', 'gitignore', 'editorconfig', 'npmrc']],
	[FileSpreadsheet, ['csv', 'tsv', 'xls', 'xlsx', 'ods', 'numbers']],
	[FileArchive, ['7z', 'gz', 'rar', 'tar', 'tgz', 'zip', 'bz2', 'xz', 'jar']],
	[FileBox, ['bin', 'dmg', 'exe', 'wasm', 'so', 'dll', 'dylib', 'iso', 'o']],
	[FileKey, ['pem', 'key', 'crt', 'cer', 'pub']],
	[FileLock, ['lock']],
	[FileType, ['ttf', 'otf', 'woff', 'woff2']],
	[FileText, ['doc', 'docx', 'odt', 'rtf', 'pdf', 'txt', 'log', 'md', 'markdown']],
];

const byExtension = new Map(groups.flatMap(([icon, extensions]) => extensions.map((extension) => [extension, icon] as const)));

const byKind: Partial<Record<string, LucideIcon>> = { image: FileImage, audio: FileMusic, video: FileVideo, mermaid: FileChartPie, excalidraw: FilePenLine, tldraw: FilePenLine, pdf: FileText };

export function fileIcon(filePath: string): LucideIcon {
	const name = filePath.split(/[\\/]/).pop()?.toLowerCase() ?? '';
	const extension = name.split('.').pop() ?? '';
	if (name === '.env' || name.startsWith('.env.')) return FileCog;
	if (name === 'dockerfile' || name === 'makefile') return FileTerminal;
	return byKind[workspaceFileType(filePath).kind] ?? byExtension.get(extension) ?? File;
}
