import { useEffect, useRef, type ReactElement } from 'react';

const SAMPLES = [0.1, 0.5, 0.9];

export function BrowserScreen({
	targetId,
	error,
	suppressed,
	danger,
}: {
	readonly targetId: string;
	readonly error?: string;
	readonly suppressed?: boolean;
	readonly danger?: ReactElement;
}): ReactElement {
	const box = useRef<HTMLDivElement>(null);

	// ponytail: the page is a native view above the app, so each frame checks where the
	// box is and whether an app overlay covers it; switch to observers if this ever shows in a profile
	useEffect(() => {
		const element = box.current;
		if (!element || error || suppressed || danger) {
			// Hidden while a renderer overlay (the address dropdown) needs to show over the page.
			window.browserPane.view(null);
			return;
		}
		let frame = 0;
		let last = '';
		const sync = (): void => {
			frame = requestAnimationFrame(sync);
			const rect = element.getBoundingClientRect();
			const covered = SAMPLES.some((across) =>
				SAMPLES.some((down) => {
					const hit = document.elementFromPoint(
						rect.left + rect.width * across,
						rect.top + rect.height * down
					);
					// A modal menu sets pointer-events: none on body, so hits fall through to <html>.
					return hit !== element && hit !== document.documentElement;
				})
			);
			const next =
				covered || rect.width < 1 || rect.height < 1
					? null
					: { targetId, x: rect.left, y: rect.top, width: rect.width, height: rect.height };
			const key = JSON.stringify(next);
			if (key === last) return;
			last = key;
			window.browserPane.view(next);
		};
		sync();
		return () => {
			cancelAnimationFrame(frame);
			window.browserPane.view(null);
		};
	}, [targetId, error, suppressed]);

	return (
		<div ref={box} aria-label="Web page" className="flex min-h-0 flex-1 items-center justify-center bg-background p-6">
			{error ? (
				<p role="alert" className="text-center text-sm text-muted-foreground">
					This page could not be loaded. {error}
				</p>
			) : null}
		</div>
	);
}
