const MEDIA_TOOLS = new Set([
	'create_image',
	'create_video',
	'create_sound',
	'microphone_recorder',
	'camera_recorder',
	'screen_recorder',
]);

export function isMediaOutputTool(toolName: string, args: Record<string, unknown>): boolean {
	return MEDIA_TOOLS.has(toolName) ||
		(toolName === 'use_web_browser' && (args.action === 'screenshot' || args.action === 'pdf'));
}
