import { useEffect, useRef, type MouseEvent, type ReactElement } from 'react';

const BUTTONS = ['left', 'middle', 'right'] as const;
const MODIFIERS = ['Shift', 'Control', 'Alt', 'Meta'];

export function BrowserScreen({ targetId }: { readonly targetId: string }): ReactElement {
	const box = useRef<HTMLDivElement>(null);
	const image = useRef<HTMLImageElement>(null);
	const frameWidth = useRef(0);

	useEffect(() => {
		const element = box.current;
		if (!element) return;
		let timer: number | undefined;
		const observer = new ResizeObserver(() => {
			window.clearTimeout(timer);
			timer = window.setTimeout(() => {
				if (element.clientWidth && element.clientHeight)
					window.browserPane.view({
						targetId,
						width: element.clientWidth,
						height: element.clientHeight,
					});
			}, 100);
		});
		observer.observe(element);
		const off = window.browserPane.onFrame((frame) => {
			if (frame.targetId !== targetId || !image.current) return;
			frameWidth.current = frame.width;
			image.current.src = `data:image/jpeg;base64,${frame.data}`;
			image.current.hidden = false;
		});
		return () => {
			window.clearTimeout(timer);
			observer.disconnect();
			off();
			window.browserPane.view(null);
		};
	}, [targetId]);

	const mouse = (type: 'move' | 'down' | 'up', event: MouseEvent): void => {
		const rect = image.current?.getBoundingClientRect();
		if (!rect?.width || !frameWidth.current) return;
		const scale = frameWidth.current / rect.width;
		window.browserPane.input({
			targetId,
			type,
			x: Math.max(0, (event.clientX - rect.left) * scale),
			y: Math.max(0, (event.clientY - rect.top) * scale),
			button: BUTTONS[event.button] ?? 'left',
			count: Math.min(event.detail, 3),
		});
	};

	return (
		<div
			ref={box}
			role="application"
			aria-label="Web page. Press F6 to leave the page."
			tabIndex={0}
			className="relative min-h-0 flex-1 overflow-hidden bg-background outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
			onPointerDown={(event) => {
				event.currentTarget.focus();
				event.currentTarget.setPointerCapture(event.pointerId);
			}}
			onMouseDown={(event) => mouse('down', event)}
			onMouseMove={(event) => mouse('move', event)}
			onMouseUp={(event) => mouse('up', event)}
			onContextMenu={(event) => event.preventDefault()}
			onWheel={(event) => {
				const rect = image.current?.getBoundingClientRect();
				if (!rect?.width || !frameWidth.current) return;
				const scale = frameWidth.current / rect.width;
				window.browserPane.input({
					targetId,
					type: 'wheel',
					x: Math.max(0, (event.clientX - rect.left) * scale),
					y: Math.max(0, (event.clientY - rect.top) * scale),
					deltaX: event.deltaX,
					deltaY: event.deltaY,
				});
			}}
			onPaste={(event) => {
				event.preventDefault();
				const text = event.clipboardData.getData('text/plain');
				if (text) window.browserPane.input({ targetId, type: 'paste', text });
			}}
			onKeyDown={(event) => {
				if (event.key === 'F6') return event.currentTarget.blur();
				if (MODIFIERS.includes(event.key) || event.nativeEvent.isComposing) return;
				const shortcut = event.metaKey || event.ctrlKey;
				if (shortcut && !/^(Key[ACXZ]|Arrow|Backspace|Delete)/.test(event.code)) return;
				event.preventDefault();
				if (event.key.length === 1 && !shortcut)
					return window.browserPane.input({ targetId, type: 'type', text: event.key });
				const key = [
					event.metaKey && 'Meta',
					event.ctrlKey && 'Control',
					event.altKey && 'Alt',
					event.shiftKey && 'Shift',
					event.code,
				];
				window.browserPane.input({ targetId, type: 'press', key: key.filter(Boolean).join('+') });
			}}
		>
			<img ref={image} hidden alt="" draggable={false} className="block w-full select-none" />
		</div>
	);
}
