import { useCallback, useRef, type ForwardedRef } from 'react';
import { revealSelection } from '@/lib/selection';

export function useSelection(ref: ForwardedRef<HTMLDivElement>) {
	const frame = useRef<number | null>(null);
	const observer = useRef<MutationObserver | null>(null);
	return useCallback((element: HTMLDivElement | null) => {
		if (typeof ref === 'function') ref(element);
		else if (ref) ref.current = element;
		observer.current?.disconnect();
		if (frame.current !== null) cancelAnimationFrame(frame.current);
		if (!element) return;
		const reveal = (): void => {
			if (frame.current !== null) cancelAnimationFrame(frame.current);
			frame.current = requestAnimationFrame(() => revealSelection(element));
		};
		observer.current = new MutationObserver(reveal);
		observer.current.observe(element, { attributes: true, attributeFilter: ['data-state'] });
		reveal();
	}, [ref]);
}
