import type { MessageContentBlock } from '../types';

export function mergeProviderItems(blocks: MessageContentBlock[]): MessageContentBlock[] {
	const merged: MessageContentBlock[] = [];
	for (const block of blocks) {
		const previous = merged.at(-1);
		if (
			block.type === 'provider_item' &&
			previous?.type === 'provider_item' &&
			previous.provider === block.provider &&
			typeof previous.item === 'string' &&
			typeof block.item === 'string'
		) {
			merged[merged.length - 1] = { ...previous, item: previous.item + block.item };
			continue;
		}
		merged.push(block);
	}
	return merged;
}
