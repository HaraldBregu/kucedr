import { useEffect, useMemo, useRef, useState } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useStickToBottomContext } from '@/hooks/use-stick-to-bottom';
import { cn } from '@/lib/utils';
import type { HomeChatMessage } from './context/state';

export function ChatOutline({ messages }: { readonly messages: readonly HomeChatMessage[] }): React.JSX.Element | null {
	const { scrollRef, contentRef, stopScroll } = useStickToBottomContext();
	const [active, setActive] = useState<string>();
	const clicked = useRef<string | null>(null);
	const turns = useMemo(() => messages.flatMap((message, index) => {
		if (message.role !== 'user' || (!message.content.trim() && !message.attachments?.length)) return [];
		const next = messages.findIndex((entry, offset) => offset > index && entry.role === 'user');
		return [{
			id: message.id,
			title: message.content.trim() || message.attachments?.map((attachment) => attachment.name).join(', ') || 'Attachments',
			response: messages.slice(index + 1, next < 0 ? undefined : next).filter((entry) => entry.role === 'agent').map((entry) => entry.content).join('\n').trim(),
		}];
	}), [messages]);
	useEffect(() => {
		const viewport = scrollRef.current;
		if (!viewport) return;
		const update = (): void => {
			if (clicked.current && viewport.scrollTop + viewport.clientHeight >= viewport.scrollHeight - 2) {
				setActive(clicked.current);
				return;
			}
			const top = viewport.getBoundingClientRect().top + 48;
			const anchors = Array.from(contentRef.current?.querySelectorAll<HTMLElement>('[data-chat-turn]') ?? []);
			setActive(anchors.findLast((anchor) => anchor.getBoundingClientRect().top <= top)?.dataset.chatTurn ?? turns[0]?.id);
		};
		const release = (): void => { clicked.current = null; };
		update();
		viewport.addEventListener('scroll', update, { passive: true });
		viewport.addEventListener('wheel', release, { passive: true });
		viewport.addEventListener('touchstart', release, { passive: true });
		viewport.addEventListener('keydown', release);
		return () => {
			viewport.removeEventListener('scroll', update);
			viewport.removeEventListener('wheel', release);
			viewport.removeEventListener('touchstart', release);
			viewport.removeEventListener('keydown', release);
		};
	}, [scrollRef, contentRef, turns]);
	if (turns.length < 2) return null;
	return (
		<nav aria-label="Conversation outline" className="absolute left-1 top-1/2 z-10 max-h-[50%] -translate-y-1/2 overflow-y-auto py-2">
			{turns.map((turn) => (
				<Tooltip key={turn.id}>
					<TooltipTrigger render={
						<button
							type="button"
							aria-label={turn.title}
							aria-current={active === turn.id ? 'location' : undefined}
							className="group flex h-4 w-8 items-center rounded-sm px-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
							onClick={() => {
								const viewport = scrollRef.current;
								const anchor = Array.from(contentRef.current?.querySelectorAll<HTMLElement>('[data-chat-turn]') ?? []).find((element) => element.dataset.chatTurn === turn.id);
								if (!viewport || !anchor) return;
								stopScroll();
								clicked.current = turn.id;
								setActive(turn.id);
								viewport.scrollTo({ top: viewport.scrollTop + anchor.getBoundingClientRect().top - viewport.getBoundingClientRect().top - 24, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
							}}
						>
							<span aria-hidden className={cn('h-0.5 rounded-full transition-colors group-hover:bg-foreground group-focus-visible:bg-foreground', active === turn.id ? 'w-5 bg-foreground' : 'w-3 bg-muted-foreground/30')} />
						</button>
					} />
					<TooltipContent side="right" sideOffset={8} className="block w-80 max-w-[calc(100vw-4rem)] rounded-xl border bg-popover p-3 text-sm text-popover-foreground shadow-lg [&>svg]:hidden">
						<p className="line-clamp-2 font-medium">{turn.title}</p>
						{turn.response && <p className="mt-1 line-clamp-3 text-muted-foreground">{turn.response}</p>}
					</TooltipContent>
				</Tooltip>
			))}
		</nav>
	);
}
