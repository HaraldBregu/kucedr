import { defaultUrlTransform } from 'react-markdown';

export function workspaceMarkdownUrl(url: string, key: string): string {
	return key === 'src' && url.startsWith('local-resource://file/') ? url : defaultUrlTransform(url);
}
