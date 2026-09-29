import {
	File,
	FileArchive,
	FileAudio,
	FileCode2,
	FileImage,
	FileSpreadsheet,
	FileText,
	FileVideo,
	type LucideIcon,
} from 'lucide-react';

export function libraryFileIcon(name: string): LucideIcon {
	if (/\.(png|jpe?g|gif|webp|bmp|svg|ico|heic|avif)$/i.test(name)) return FileImage;
	if (/\.(mp3|wav|ogg|flac|m4a|aac|opus)$/i.test(name)) return FileAudio;
	if (/\.(mp4|mov|mkv|webm|avi|m4v)$/i.test(name)) return FileVideo;
	if (/\.(zip|rar|7z|tar|gz|bz2|xz)$/i.test(name)) return FileArchive;
	if (/\.(csv|tsv|xlsx?|ods)$/i.test(name)) return FileSpreadsheet;
	if (/\.(js|jsx|ts|tsx|json|html|css|scss|py|rb|go|rs|java|c|cpp|h|sh|sql)$/i.test(name)) {
		return FileCode2;
	}
	if (/\.(txt|md|mdx|pdf|docx?|rtf|odt|log|yaml|yml|toml|xml)$/i.test(name)) return FileText;
	return File;
}
