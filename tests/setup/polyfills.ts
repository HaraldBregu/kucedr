import { TextDecoder, TextEncoder } from 'node:util';

Object.assign(globalThis, {
	TextDecoder: globalThis.TextDecoder ?? TextDecoder,
	TextEncoder: globalThis.TextEncoder ?? TextEncoder,
});

// jsdom implements neither of these; components read prefers-color-scheme on
// mount and scroll the active option into view.
if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
	Object.defineProperty(window, 'matchMedia', {
		configurable: true,
		writable: true,
		value: (query: string) => ({
			matches: false,
			media: query,
			onchange: null,
			addEventListener: () => undefined,
			removeEventListener: () => undefined,
			addListener: () => undefined,
			removeListener: () => undefined,
			dispatchEvent: () => false,
		}),
	});
}

if (typeof Element !== 'undefined' && !Element.prototype.scrollIntoView) {
	Element.prototype.scrollIntoView = function scrollIntoView(): void {
		return undefined;
	};
}
