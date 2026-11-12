import type { Message } from '../types';
import { isInternalMessage } from './run_internal';

export function turnStart(messages: readonly Message[], index: number): number {
	while (
		index > 0 &&
		messages[index - 1].role === 'user' &&
		isInternalMessage(messages[index - 1])
	)
		index -= 1;
	return index;
}
