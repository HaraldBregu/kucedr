import type { AgentMessage } from '../context/state';
import { generatedMedia } from './media';

export function chatAssets(messages: readonly AgentMessage[]): { path: string; messageId: string }[] {
	const assets = new Map<string, { path: string; messageId: string }>();
	for (const message of messages) {
		const paths = generatedMedia(message.tools).flatMap((media) => media.paths);
		for (const tool of message.tools) {
			if (tool.type !== 'write' || tool.state !== 'output-available') continue;
			let output = tool.output;
			if (typeof output === 'string') {
				try { output = JSON.parse(output); } catch { continue; }
			}
			if (output && typeof output === 'object' && 'path' in output && typeof output.path === 'string' && output.path) paths.push(output.path);
		}
		for (const path of paths) assets.set(path, { path, messageId: message.id });
	}
	return Array.from(assets.values());
}
