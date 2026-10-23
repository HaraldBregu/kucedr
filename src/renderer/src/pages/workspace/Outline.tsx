import { useEffect, useState } from 'react';
import { useEditorState, type Editor } from '@tiptap/react';

const indents = ['pl-3', 'pl-6', 'pl-9', 'pl-12', 'pl-14', 'pl-16'];

interface WorkspaceOutlineProps {
	readonly editor: Editor;
	readonly container: React.RefObject<HTMLDivElement | null>;
}

export function WorkspaceOutline({ editor, container }: WorkspaceOutlineProps): React.JSX.Element | null {
	const [active, setActive] = useState(-1);
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
			const top = element.getBoundingClientRect().top + 32;
			setActive(headings.findLastIndex(({ pos }) => {
				const dom = editor.view.nodeDOM(pos);
				return dom instanceof HTMLElement && dom.getBoundingClientRect().top <= top;
			}));
		};
		const frame = requestAnimationFrame(update);
		element.addEventListener('scroll', update, { passive: true });
		return () => {
			cancelAnimationFrame(frame);
			element.removeEventListener('scroll', update);
		};
	}, [container, editor, headings]);
	if (headings.length === 0) return null;
	return (
		<nav aria-label="On this page" className="sticky top-0 hidden max-h-full w-60 shrink-0 self-start overflow-y-auto py-8 pr-4 xl:block">
			<p className="mb-2 text-xs font-medium text-muted-foreground">On this page</p>
			<ul className="flex flex-col border-l text-sm">
				{headings.map(({ pos, level, text }, index) => (
					<li key={index}>
						<button
							type="button"
							title={text}
							aria-current={index === active ? 'location' : undefined}
							className={`-ml-px block w-full truncate border-l border-transparent py-1 pr-2 text-left text-muted-foreground hover:text-foreground aria-[current=location]:border-primary aria-[current=location]:text-foreground ${indents[level - 1] ?? 'pl-3'}`}
							onClick={() => {
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
