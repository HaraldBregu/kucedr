import { useEffect, useRef, useState } from 'react';
import { useEditorState, type Editor } from '@tiptap/react';
import { cn } from '@/lib/utils';

const minimumHeadings = 4;
const bars = ['w-5', 'w-4', 'w-3', 'w-2.5', 'w-2', 'w-2'];
const indents = ['pl-2', 'pl-5', 'pl-8', 'pl-11', 'pl-12', 'pl-12'];

interface WorkspaceOutlineProps {
	readonly editor: Editor;
	readonly container: React.RefObject<HTMLDivElement | null>;
}

export function WorkspaceOutline({ editor, container }: WorkspaceOutlineProps): React.JSX.Element | null {
	const [active, setActive] = useState(0);
	const clicked = useRef(-1);
	const headings = useEditorState({
		editor,
		selector: ({ editor: current }) => {
			const list: { pos: number; level: number; text: string }[] = [];
			current.state.doc.descendants((node, pos) => {
				if (node.type.name !== 'heading') return true;
				list.push({ pos, level: node.attrs.level as number, text: node.textContent });
				return false;
			});
			return list;
		},
	});
	useEffect(() => {
		const element = container.current;
		if (!element) return;
		const update = (): void => {
			if (clicked.current >= 0 && element.scrollTop + element.clientHeight >= element.scrollHeight - 2) return setActive(clicked.current);
			const top = element.getBoundingClientRect().top + 96;
			setActive(Math.max(0, headings.findLastIndex(({ pos }) => {
				const dom = editor.view.nodeDOM(pos);
				return dom instanceof HTMLElement && dom.getBoundingClientRect().top <= top;
			})));
		};
		const release = (): void => {
			clicked.current = -1;
		};
		const frame = requestAnimationFrame(update);
		element.addEventListener('scroll', update, { passive: true });
		element.addEventListener('wheel', release, { passive: true });
		return () => {
			cancelAnimationFrame(frame);
			element.removeEventListener('scroll', update);
			element.removeEventListener('wheel', release);
		};
	}, [container, editor, headings]);
	if (headings.length < minimumHeadings) return null;
	return (
		<nav aria-label="On this page" className="group absolute right-2 top-1/2 z-10 -translate-y-1/2">
			<div aria-hidden className="flex flex-col items-end gap-2 p-2 transition-opacity group-focus-within:opacity-0 group-hover:opacity-0">
				{headings.map(({ level }, index) => (
					<span key={index} className={cn('h-0.5 rounded-full transition-colors', bars[level - 1] ?? 'w-2', index === active ? 'bg-foreground' : 'bg-muted-foreground/30')} />
				))}
			</div>
			<ul className="pointer-events-none absolute right-0 top-1/2 flex max-h-[70vh] w-64 -translate-y-1/2 translate-x-2 flex-col gap-0.5 overflow-y-auto rounded-xl bg-popover/80 p-1.5 text-sm text-popover-foreground opacity-0 shadow-lg backdrop-blur-md transition-all duration-150 group-focus-within:pointer-events-auto group-focus-within:translate-x-0 group-focus-within:opacity-100 group-hover:pointer-events-auto group-hover:translate-x-0 group-hover:opacity-100">
				{headings.map(({ pos, level, text }, index) => (
					<li key={index}>
						<button
							type="button"
							title={text}
							aria-current={index === active ? 'location' : undefined}
							className={cn('block w-full truncate rounded-md py-1 pr-2 text-left text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:outline-none aria-[current=location]:font-medium aria-[current=location]:text-foreground', indents[level - 1] ?? 'pl-2')}
							onClick={() => {
								clicked.current = index;
								setActive(index);
								editor.chain().setTextSelection(pos + 1).focus(undefined, { scrollIntoView: false }).run();
								(editor.view.nodeDOM(pos) as HTMLElement | null)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
							}}
						>
							{text || 'Untitled'}
						</button>
					</li>
				))}
			</ul>
		</nav>
	);
}
