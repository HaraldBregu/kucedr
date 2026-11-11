import { useEffect, useRef, useState, type RefObject } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import type { StickToBottomContext } from '@/hooks/use-stick-to-bottom';

export function ChatSearch({ scroll, active, refreshKey }: {
	readonly scroll: RefObject<StickToBottomContext | null>;
	readonly active: boolean;
	readonly refreshKey: unknown;
}): React.JSX.Element {
	const [query, setQuery] = useState('');
	const [index, setIndex] = useState(0);
	const [count, setCount] = useState(0);
	const ranges = useRef<Range[]>([]);
	const needle = active ? query.trim() : '';
	useEffect(() => {
		const content = scroll.current?.contentRef.current;
		const found: Range[] = [];
		if (content && needle) {
			// ponytail: rescans every rendered text node per change and misses matches split across inline elements or inside collapsed sections; index message text instead if chats get huge
			const pattern = new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
			const walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT);
			for (let node = walker.nextNode(); node; node = walker.nextNode()) {
				if (!node.parentElement?.checkVisibility()) continue;
				for (const match of (node.textContent ?? '').matchAll(pattern)) {
					const range = new Range();
					range.setStart(node, match.index);
					range.setEnd(node, match.index + match[0].length);
					found.push(range);
				}
			}
		}
		ranges.current = found;
		setCount(found.length);
		CSS.highlights.set('chat-search', new Highlight(...found));
		return () => { CSS.highlights.delete('chat-search'); };
	}, [scroll, needle, refreshKey]);
	useEffect(() => {
		const viewport = scroll.current?.scrollRef.current;
		const range = ranges.current[index];
		if (!viewport || !range) return;
		const current = new Highlight(range);
		current.priority = 1;
		CSS.highlights.set('chat-search-current', current);
		scroll.current?.stopScroll();
		viewport.scrollTo({ top: viewport.scrollTop + range.getBoundingClientRect().top - viewport.getBoundingClientRect().top - viewport.clientHeight / 3, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
		return () => { CSS.highlights.delete('chat-search-current'); };
	}, [scroll, needle, index]);
	return (
		<div className="relative mx-3 mb-3">
			<Search className="pointer-events-none absolute top-1/2 left-2.5 z-10 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
			<Input
				type="search"
				value={query}
				placeholder="Search chat"
				aria-label="Search chat"
				className="h-8 pr-12 pl-8 [&::-webkit-search-cancel-button]:hidden"
				onChange={(event) => {
					setQuery(event.target.value);
					setIndex(0);
				}}
				onKeyDown={(event) => {
					if (event.key !== 'Enter' || !count) return;
					event.preventDefault();
					setIndex((Math.min(index, count - 1) + (event.shiftKey ? count - 1 : 1)) % count);
				}}
			/>
			{needle && <span className="pointer-events-none absolute inset-y-0 right-2.5 z-10 flex items-center text-xs tabular-nums text-muted-foreground" aria-live="polite">{count ? Math.min(index, count - 1) + 1 : 0}/{count}</span>}
		</div>
	);
}
