import { useEffect, useImperativeHandle, useState, type ForwardedRef } from 'react';
import { revealSelection } from '@/lib/selection';

export function useSelection(ref: ForwardedRef<HTMLDivElement>) {
	const [element, setElement] = useState<HTMLDivElement | null>(null);
	useImperativeHandle<HTMLDivElement | null, HTMLDivElement | null>(ref, () => element, [element]);
	useEffect(() => {
		if (!element) return;
		let frame = 0;
		const reveal = (): void => {
			cancelAnimationFrame(frame);
			frame = requestAnimationFrame(() => revealSelection(element));
		};
		const observer = new MutationObserver(reveal);
		observer.observe(element, { attributes: true, attributeFilter: ['data-state'] });
		reveal();
		return () => {
			observer.disconnect();
			cancelAnimationFrame(frame);
		};
	}, [element]);
	return setElement;
}
