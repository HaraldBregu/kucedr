import { setTimeout as sleep } from 'node:timers/promises';
import { cursor } from './cursor';
import { locate } from './locate';
import type { BrowserTab } from './pane';
import { press } from './press';

const DEFAULT_TIMEOUT_MS = 15_000;
const BUTTONS = { left: 1, right: 2, middle: 4 };

export interface BrowserAct {
	kind: 'click' | 'type' | 'press' | 'hover' | 'drag' | 'select' | 'fill' | 'wait' | 'evaluate';
	ref?: string;
	text?: string;
	key?: string;
	values?: string[];
	fields?: { ref: string; value: string }[];
	startRef?: string;
	endRef?: string;
	submit?: boolean;
	doubleClick?: boolean;
	button?: 'left' | 'right' | 'middle';
	fn?: string;
	timeMs?: number;
	selector?: string;
	loadState?: 'load' | 'domcontentloaded' | 'networkidle';
	timeoutMs?: number;
}

interface Evaluation {
	result: { value?: unknown };
	exceptionDetails?: { exception?: { className?: string; description?: string } };
}

export async function act(tab: BrowserTab, params: BrowserAct, signal?: AbortSignal): Promise<string> {
	const contents = tab.view.webContents;
	const timeout = params.timeoutMs ?? DEFAULT_TIMEOUT_MS;
	const js = <T>(code: string): Promise<T> => contents.executeJavaScript(code, true) as Promise<T>;
	const find = (ref: string): Promise<{ x: number; y: number }> => locate(tab, ref, timeout, signal);
	const mouse = (type: string, at: { x: number; y: number }, extra: object = {}): Promise<unknown> =>
		contents.debugger.sendCommand('Input.dispatchMouseEvent', { type, ...at, button: 'none', ...extra });
	const travel = async (to: { x: number; y: number }, extra: object = {}): Promise<void> => {
		const from = tab.pointer ?? to;
		const wait = await cursor(tab, 'move', to);
		for (const part of [0.25, 0.5, 0.75])
			await mouse(
				'mouseMoved',
				{ x: from.x + (to.x - from.x) * part, y: from.y + (to.y - from.y) * part },
				extra
			);
		if (wait) await sleep(wait);
		await mouse('mouseMoved', to, extra);
		tab.pointer = to;
	};
	const requireRef = (): string => {
		if (!params.ref) throw new Error(`act "${params.kind}" requires a ref from snapshot output.`);
		return params.ref;
	};
	const fill = async (ref: string, text: string): Promise<void> => {
		await travel(await find(ref));
		await cursor(tab, 'field', undefined, ref);
		await js(`(() => {
			const el = document.querySelector('[data-agent-ref="${ref}"]');
			el.focus();
			if (typeof el.select === 'function') el.select();
			else document.execCommand('selectAll');
			if (${text === ''}) document.execCommand('delete');
		})()`);
		if (text) await contents.debugger.sendCommand('Input.insertText', { text });
	};
	const until = async (check: () => Promise<boolean>, what: string): Promise<void> => {
		const deadline = Date.now() + timeout;
		while (!(await check())) {
			signal?.throwIfAborted();
			if (Date.now() > deadline) throw new Error(`Timed out waiting for ${what}.`);
			await sleep(250);
		}
	};

	switch (params.kind) {
		case 'click': {
			const at = await find(requireRef());
			const button = params.button ?? 'left';
			await travel(at);
			await cursor(tab, 'click', at);
			for (const clickCount of params.doubleClick ? [1, 2] : [1]) {
				await mouse('mousePressed', at, { button, buttons: BUTTONS[button], clickCount });
				await mouse('mouseReleased', at, { button, clickCount });
			}
			return 'clicked';
		}
		case 'type':
			await fill(requireRef(), params.text ?? '');
			if (params.submit) await press(tab, 'Enter');
			return 'typed';
		case 'press':
			if (!params.key) throw new Error('act "press" requires a key (e.g. "Enter", "Tab").');
			await press(tab, params.key);
			return `pressed ${params.key}`;
		case 'hover':
			await travel(await find(requireRef()));
			return 'hovered';
		case 'drag': {
			if (!params.startRef || !params.endRef) throw new Error('act "drag" requires startRef and endRef.');
			const from = await find(params.startRef);
			await travel(from);
			await mouse('mousePressed', from, { button: 'left', buttons: 1, clickCount: 1 });
			const to = await find(params.endRef);
			await travel(to, { buttons: 1 });
			await mouse('mouseReleased', to, { button: 'left', clickCount: 1 });
			return 'dragged';
		}
		case 'select': {
			if (!params.values?.length) throw new Error('act "select" requires values.');
			const ref = requireRef();
			await travel(await find(ref));
			await cursor(tab, 'field', undefined, ref);
			const selected = await js<string[]>(`(() => {
				const el = document.querySelector('[data-agent-ref="${ref}"]');
				if (!(el instanceof HTMLSelectElement)) throw new Error('Element is not a select.');
				const wanted = ${JSON.stringify(params.values)};
				const chosen = [];
				for (const option of el.options) {
					const match = wanted.includes(option.value) || wanted.includes(option.label);
					if (el.multiple) option.selected = match;
					else if (match && !chosen.length) el.value = option.value;
					if (match && (el.multiple || !chosen.length)) chosen.push(option.value);
				}
				el.dispatchEvent(new Event('input', { bubbles: true }));
				el.dispatchEvent(new Event('change', { bubbles: true }));
				return chosen;
			})()`);
			return `selected ${JSON.stringify(selected)}`;
		}
		case 'fill':
			if (!params.fields?.length) throw new Error('act "fill" requires fields: [{ref, value}].');
			for (const field of params.fields) await fill(field.ref, field.value ?? '');
			return `filled ${params.fields.length} field(s)`;
		case 'wait':
			if (params.selector) {
				const selector = JSON.stringify(params.selector);
				await until(
					() =>
						js<boolean>(`(() => {
							const rect = document.querySelector(${selector})?.getBoundingClientRect();
							return Boolean(rect && rect.width && rect.height);
						})()`),
					`selector ${params.selector}`
				);
			} else if (params.loadState === 'networkidle') {
				// ponytail: "idle" means loaded and no new resource for one poll; count requests if this proves too loose
				let seen = -1;
				await until(async () => {
					const [ready, count] = await js<[boolean, number]>(
						`[document.readyState === 'complete', performance.getEntriesByType('resource').length]`
					);
					const idle = ready && count === seen;
					seen = count;
					return idle;
				}, 'the network to go idle');
			} else if (params.loadState) {
				const state = params.loadState === 'load' ? `=== 'complete'` : `!== 'loading'`;
				await until(() => js<boolean>(`document.readyState ${state}`), `the page to reach ${params.loadState}`);
			} else await sleep(params.timeMs ?? 1_000, undefined, { signal });
			return 'waited';
		case 'evaluate': {
			if (!params.fn) throw new Error('act "evaluate" requires fn (a JS expression or function).');
			if (tab.filled)
				throw new Error('Running scripts is blocked on this page because a saved password was filled here.');
			const run = (expression: string): Promise<Evaluation> =>
				contents.debugger.sendCommand('Runtime.evaluate', {
					expression,
					awaitPromise: true,
					returnByValue: true,
					userGesture: true,
				}) as Promise<Evaluation>;
			let outcome = await run(
				`(() => { const value = (${params.fn}\n); return typeof value === 'function' ? value() : value; })()`
			);
			if (outcome.exceptionDetails?.exception?.className === 'SyntaxError') outcome = await run(params.fn);
			if (outcome.exceptionDetails)
				throw new Error(outcome.exceptionDetails.exception?.description ?? 'Evaluation failed.');
			return JSON.stringify(outcome.result.value) ?? 'undefined';
		}
	}
}
