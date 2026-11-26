import path from 'node:path';
import { currentWorkspace } from '../../../workspaces/current';
import { realPath } from '../../../shared/real_path';
import { resolveUserPath } from '../../../shared/user_path';
import { executionScope } from '../../execution/scope';
import { readFileBounded } from '../../files/read';
import { getPermissions, resolvePermission } from '../../permissions';

const MAX_INLINE_BYTES = 20 * 1024 * 1024;

const MIME_TYPES: Record<string, string> = {
	'.jpg': 'image/jpeg',
	'.jpeg': 'image/jpeg',
	'.png': 'image/png',
	'.webp': 'image/webp',
	'.gif': 'image/gif',
	'.mp3': 'audio/mpeg',
	'.wav': 'audio/wav',
	'.ogg': 'audio/ogg',
	'.m4a': 'audio/mp4',
};

export async function inlineFiles(value: unknown, key?: string): Promise<unknown> {
	if (key === 'url' && typeof value === 'string' && !/^(https?|data):/i.test(value)) {
		const filePath = realPath(resolveUserPath(value, currentWorkspace().files));
		const mimeType = MIME_TYPES[path.extname(filePath).toLowerCase()];
		if (!mimeType) throw new Error(`Unsupported media file type: ${value}`);
		const permission = resolvePermission({
			access: { read: [filePath] },
			permissions: getPermissions(),
			interactive: executionScope.getStore()?.interactive === true,
		});
		if (permission.mode !== 'allow') throw new Error(`Reading ${value} is not permitted.`);
		return `data:${mimeType};base64,${(await readFileBounded(filePath, MAX_INLINE_BYTES)).toString('base64')}`;
	}
	if (Array.isArray(value)) return Promise.all(value.map((item) => inlineFiles(item)));
	if (value && typeof value === 'object') {
		const entries = await Promise.all(
			Object.entries(value).map(async ([name, item]) => [name, await inlineFiles(item, name)])
		);
		return Object.fromEntries(entries);
	}
	return value;
}
