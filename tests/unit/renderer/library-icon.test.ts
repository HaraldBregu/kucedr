import {
	File,
	FileArchive,
	FileAudio,
	FileCode2,
	FileImage,
	FileSpreadsheet,
	FileText,
	FileVideo,
} from 'lucide-react';
import { libraryFileIcon } from '../../../src/renderer/src/pages/settings/pages/library/icon';

it.each([
	['photo.png', FileImage],
	['recording.mp3', FileAudio],
	['clip.mp4', FileVideo],
	['bundle.zip', FileArchive],
	['data.xlsx', FileSpreadsheet],
	['script.ts', FileCode2],
	['notes.md', FileText],
	['unknown.bin', File],
])('uses the expected icon for %s', (name, expected) => {
	expect(libraryFileIcon(name)).toBe(expected);
});
