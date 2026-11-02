import { useState, type ReactElement } from 'react';
import { ChevronDown } from 'lucide-react';
import { TextShimmer } from '@/components/prompt-kit/text-shimmer';
import { Tool } from '@/components/prompt-kit/tool';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import type { AgentToolPart } from '../context';
import { isToolRunning, toolActivityLabel, toolPartLabel } from './tool-label';

function reflectedLabel(ms: number): string {
	if (ms >= 60_000) {
		const minutes = Math.round(ms / 60_000);
		return `Reflected for ${minutes} minute${minutes === 1 ? '' : 's'}`;
	}
	const seconds = Math.max(1, Math.round(ms / 1000));
	return `Reflected for ${seconds} second${seconds === 1 ? '' : 's'}`;
}

export function ToolActivityGroup({
	tools,
	isActive = false,
	className,
}: {
	readonly tools: readonly AgentToolPart[];
	readonly isActive?: boolean;
	readonly className?: string;
}): ReactElement {
	const [isOpen, setIsOpen] = useState(false);
	const running = tools.filter(isToolRunning);
	const isBusy = isActive || running.length > 0;
	const label =
		running.length > 0
			? toolActivityLabel(running[running.length - 1])
			: isActive
				? 'Thinking…'
				: reflectedLabel(tools.reduce((total, tool) => total + (tool.durationMs ?? 0), 0));

	return (
		<Collapsible
			open={isOpen}
			onOpenChange={setIsOpen}
			className={cn('flex w-full max-w-2xl flex-col gap-1', className)}
		>
			<CollapsibleTrigger
				render={
					<Button
						type="button"
						variant="ghost"
						className="p-0! h-auto w-full justify-start rounded-md bg-transparent! py-1 font-normal text-muted-foreground transition-colors hover:bg-transparent hover:text-foreground"
					>
						<span className="truncate text-sm font-medium">
							{isBusy ? <TextShimmer>{label}</TextShimmer> : label}
						</span>
						<ChevronDown
							className={cn('size-3.5 shrink-0 transition-transform', isOpen && 'rotate-180')}
						/>
					</Button>
				}
			/>
			<CollapsibleContent>
				<div className="flex flex-col gap-1">
					{tools.map((tool) => (
						<Tool key={tool.toolCallId} toolPart={tool} label={toolPartLabel(tool)} className="mt-0" />
					))}
				</div>
			</CollapsibleContent>
		</Collapsible>
	);
}
