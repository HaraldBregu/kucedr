import { setTimeout as sleep } from 'node:timers/promises';
import type { BrowserTab } from './pane';

const DEFAULT_TIMEOUT_MS = 15_000;

// ponytail: top document only, like the snapshot script; frames need a per-frame lookup
export async function locate(
	tab: BrowserTab,
	ref: string,
	timeoutMs = DEFAULT_TIMEOUT_MS,
	signal?: AbortSignal
): Promise<{ x: number; y: number }> {
	if (!/^e\d+$/.test(ref)) throw new Error(`Invalid ref "${ref}". Refs look like "e12" from snapshot output.`);
	const script = `(() => {
		const el = document.querySelector('[data-agent-ref="${ref}"]');
		if (!el) return 'was not found; take a new snapshot';
		el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
		const rect = el.getBoundingClientRect();
		if (!rect.width || !rect.height) return 'is not visible';
		const x = rect.left + rect.width / 2;
		const y = rect.top + rect.height / 2;
		const hit = document.elementFromPoint(x, y);
		if (!hit || !(el.contains(hit) || hit.contains(el))) return 'is covered by another element';
		return { x, y };
	})()`;
	const deadline = Date.now() + timeoutMs;
	for (;;) {
		signal?.throwIfAborted();
		const found = (await tab.view.webContents.executeJavaScript(script, true)) as
			| string
			| { x: number; y: number };
		if (typeof found !== 'string') return found;
		if (Date.now() > deadline) throw new Error(`Element ${ref} ${found}.`);
		await sleep(100);
	}
}
