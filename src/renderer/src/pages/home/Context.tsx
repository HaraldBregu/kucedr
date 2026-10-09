import type { ReactElement } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { HomeChatMessage } from './context/state';
import { contextTokens } from './tokens';

export function Context({
	providerId,
	modelId,
	contextWindow,
	messages,
	draft,
	hasAttachments,
}: {
	providerId: string;
	modelId: string;
	contextWindow?: number;
	messages: readonly HomeChatMessage[];
	draft: string;
	hasAttachments: boolean;
}): ReactElement {
	const usage = contextTokens(messages, providerId, modelId, draft);
	const limit = usage.contextWindow ?? contextWindow;
	const percent = limit ? Math.min(100, Math.round((usage.tokens / limit) * 100)) : undefined;
	const estimated = usage.estimated || hasAttachments;
	const label = limit
		? `${estimated ? 'Estimated context' : 'Context'}: ${usage.tokens.toLocaleString()} / ${limit.toLocaleString()} tokens (${percent}% used)`
		: 'Context window unavailable';
	return (
		<Tooltip>
			<TooltipTrigger
				render={<button type="button" aria-label={label} />}
				className="flex h-9 shrink-0 items-center gap-1.5 rounded-full px-2 text-[11px] text-muted-foreground outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
			>
				<svg
					viewBox="0 0 24 24"
					className={cn(
						'size-5 -rotate-90',
						percent !== undefined && percent >= 95
							? 'text-destructive'
							: percent !== undefined && percent >= 80
								? 'text-amber-500'
								: 'text-muted-foreground'
					)}
					role="progressbar"
					aria-label="Context window used"
					aria-valuemin={0}
					aria-valuemax={100}
					aria-valuenow={percent}
					aria-valuetext={label}
				>
					<circle
						cx="12"
						cy="12"
						r="9"
						fill="none"
						stroke="currentColor"
						strokeWidth="2.5"
						className="opacity-20"
					/>
					<circle
						cx="12"
						cy="12"
						r="9"
						fill="none"
						stroke="currentColor"
						strokeWidth="2.5"
						pathLength="100"
						strokeDasharray={`${limit ? Math.min(100, (usage.tokens / limit) * 100) : 0} 100`}
						strokeLinecap="round"
					/>
				</svg>
				<span>{percent === undefined ? '—' : `${percent}%`}</span>
			</TooltipTrigger>
			<TooltipContent className="flex-col items-start gap-1">
				<span>{label}</span>
				{!usage.measured ? (
					<span>
						Estimate of conversation and draft; instructions and tools are included when a request
						starts.
					</span>
				) : null}
				{hasAttachments ? (
					<span>Attachment tokens are counted after the provider processes them.</span>
				) : null}
				{!limit ? <span>The provider has not reported a context limit for this model.</span> : null}
			</TooltipContent>
		</Tooltip>
	);
}
