import { createElement, useState, type ReactElement } from 'react';
import { ChevronDown } from 'lucide-react';
import { useNow } from '@/components/hooks/use-now';
import { formatDuration } from '@/components/prompt-kit/duration';
import { TextShimmer } from '@/components/prompt-kit/text-shimmer';
import { isTaskToolType } from '@/components/prompt-kit/task';
import { Tool, toolIcon } from '@/components/prompt-kit/tool';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import type { AgentToolPart } from '../context';
import { isToolRunning, toolGroupLabel, toolPartLabel } from './tool-label';

type ToolTypeGroup = {
	readonly type: string;
	readonly tools: AgentToolPart[];
};

function groupToolsByType(tools: readonly AgentToolPart[]): ToolTypeGroup[] {
	const groups: ToolTypeGroup[] = [];
	for (const tool of tools) {
		const type = isTaskToolType(tool.type) ? 'task' : tool.type;
		const last = groups[groups.length - 1];
		if (last && last.type === type) {
			last.tools.push(tool);
		} else {
			groups.push({ type, tools: [tool] });
		}
	}
	return groups;
}

function staggerStyle(index: number): { animationDelay: string } {
	return { animationDelay: `${Math.min(index * 40, 240)}ms` };
}

function isLiveTool(tool: AgentToolPart): boolean {
	return tool.durationMs === undefined && tool.startedAtMs !== undefined && isToolRunning(tool);
}

function ToolTypeSection({ group }: { readonly group: ToolTypeGroup }): ReactElement {
	const [isOpen, setIsOpen] = useState(false);
	const isRunning = group.tools.some(isToolRunning);
	const label = toolGroupLabel(group.type, group.tools);
	const kindIcon = toolIcon(group.tools[0]);
	const hasLiveTool = group.tools.some(isLiveTool);
	const now = useNow(hasLiveTool);
	const hasDuration = hasLiveTool || group.tools.some((tool) => tool.durationMs !== undefined);
	const durationMs = group.tools.reduce((total, tool) => {
		if (tool.durationMs !== undefined) return total + tool.durationMs;
		if (isLiveTool(tool) && tool.startedAtMs !== undefined)
			return total + Math.max(0, now - tool.startedAtMs);
		return total;
	}, 0);

	return (
		<Collapsible open={isOpen} onOpenChange={setIsOpen}>
			<CollapsibleTrigger
				render={
					<Button
						type="button"
						variant="ghost"
						className="p-0! h-auto w-full justify-start rounded-md bg-transparent! py-1 font-normal text-muted-foreground transition-colors hover:bg-transparent hover:text-foreground"
					>
						<div className="flex min-w-0 items-center gap-1.5">
							{createElement(kindIcon, {
								className: 'size-3.5 shrink-0 text-muted-foreground/60',
							})}
							<span className="flex min-w-0 items-baseline gap-1 truncate text-xs font-medium">
								{isRunning ? <TextShimmer>{label}</TextShimmer> : <span>{label}</span>}
							</span>
							{hasDuration && (
								<span className="shrink-0 text-[10px] tabular-nums text-muted-foreground/50">
									{formatDuration(durationMs)}
								</span>
							)}
							<ChevronDown
								className={cn(
									'size-3 shrink-0 transition-transform duration-200',
									isOpen && 'rotate-180'
								)}
							/>
						</div>
					</Button>
				}
			/>
			<CollapsibleContent>
				<div className="flex flex-col gap-1 pl-3">
					{group.tools.map((tool, index) => (
						<Tool
							key={tool.toolCallId}
							toolPart={tool}
							label={toolPartLabel(tool)}
							hideIcon
							className="mt-0"
							style={staggerStyle(index)}
						/>
					))}
				</div>
			</CollapsibleContent>
		</Collapsible>
	);
}

export function ToolActivityGroup({
	tools,
	className,
}: {
	readonly tools: readonly AgentToolPart[];
	readonly className?: string;
}): ReactElement {
	const groups = groupToolsByType(tools);

	return (
		<div className={cn('flex w-full max-w-2xl flex-col gap-1', className)}>
			{groups.map((group, index) =>
				group.tools.length > 1 ? (
					<ToolTypeSection key={group.tools[0].toolCallId} group={group} />
				) : (
					<Tool
						key={group.tools[0].toolCallId}
						toolPart={group.tools[0]}
						label={toolPartLabel(group.tools[0])}
						className="mt-0"
						style={staggerStyle(index)}
					/>
				)
			)}
		</div>
	);
}
