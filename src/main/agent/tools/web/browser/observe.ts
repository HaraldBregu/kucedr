import { executionScope } from '../../../execution/scope';
import { acting, paneEvents } from './pane';
import { browserSession } from './session';

export async function observe<T>(run: () => Promise<T>): Promise<T> {
	if (browserSession().background) return run();
	const chat = executionScope.getStore()?.sessionId ?? '';
	acting.set(chat, (acting.get(chat) ?? 0) + 1);
	paneEvents.emit('change');
	try {
		return await run();
	} finally {
		const left = (acting.get(chat) ?? 1) - 1;
		if (left > 0) acting.set(chat, left);
		else acting.delete(chat);
		paneEvents.emit('change');
	}
}
