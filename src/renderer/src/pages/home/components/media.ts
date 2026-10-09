import type { AgentToolPart } from '../context';

type GeneratedMedia = { kind: 'image' | 'audio' | 'video'; paths: string[] };

export function generatedMedia(tools: readonly AgentToolPart[]): GeneratedMedia[] {
	const media: GeneratedMedia[] = [];
	const seen = new Set<string>();
	for (const tool of tools) {
		if (tool.state !== 'output-available') continue;
		let output = tool.output;
		if (typeof output === 'string') {
			try {
				output = JSON.parse(output);
			} catch {
				continue;
			}
		}
		const record = output as { images?: unknown; path?: unknown; status?: unknown } | null;
		const recorder = /^(microphone|camera|screen)_recorder(?:_(?:status|stop))?$/.exec(tool.type);
		let kind: GeneratedMedia['kind'];
		if (tool.type === 'create_image') kind = 'image';
		else if (tool.type === 'create_video') kind = 'video';
		else if (tool.type === 'create_sound') kind = 'audio';
		else if (
			tool.type === 'use_web_browser' &&
			(tool.input as { action?: unknown } | undefined)?.action === 'screenshot'
		)
			kind = 'image';
		else if (recorder && record?.status === 'completed') {
			kind = recorder[1] === 'microphone' ? 'audio' : 'video';
		} else continue;
		const images = Array.isArray(record?.images)
			? record.images
					.map((image) => (image as { path?: unknown } | null)?.path)
					.filter((value): value is string => typeof value === 'string' && value.length > 0)
			: [];
		const paths = (
			images.length > 0
				? images
				: typeof record?.path === 'string' && record.path.length > 0
					? [record.path]
					: []
		).filter((file) => {
			if (seen.has(file)) return false;
			seen.add(file);
			return true;
		});
		if (paths.length > 0) media.push({ kind, paths });
	}
	return media;
}
