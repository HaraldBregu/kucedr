import { LanguageDescription, type LanguageSupport } from '@codemirror/language';
import { languages } from '@codemirror/language-data';

export async function languageForPath(filePath: string): Promise<LanguageSupport | null> {
	return LanguageDescription.matchFilename(languages, filePath)?.load() ?? null;
}
