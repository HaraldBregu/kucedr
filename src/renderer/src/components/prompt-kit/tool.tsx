'use client';

import { createElement, useState, type CSSProperties } from 'react';
import {
	AudioLines,
	Blocks,
	Bot,
	CalendarClock,
	Camera,
	Check,
	ChevronDown,
	CircleX,
	Image,
	LoaderCircle,
	Mail,
	Mic,
	Monitor,
	PenLine,
	Plug,
	Sparkles,
	Terminal,
	Video,
	Wrench,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useNow } from '@/components/hooks/use-now';
import { cn } from '@/lib/utils';
import { formatDuration } from './duration';
import { isAppToolType } from './app';
import { isTaskToolType } from './task';
import { estimateTokens } from './tokens';

export type ToolPart = {
	type: string;
	state: 'input-streaming' | 'input-available' | 'output-available' | 'output-error';
	status?: 'ok' | 'error' | 'blocked' | 'rejected';
	displayName?: string;
	serviceKind?: string;
	serviceId?: string;
	iteration?: number;
	input?: unknown;
	inputText?: string;
	output?: unknown;
	outputText?: string;
	durationMs?: number;
	toolCallId?: string;
	errorText?: string;
	outputTokens?: number;
	startedAtMs?: number;
};

export type ToolProps = {
	toolPart: ToolPart;
	label?: string;
	defaultOpen?: boolean;
	hideIcon?: boolean;
	className?: string;
	style?: CSSProperties;
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function formatValue(value: unknown): string {
	if (value === null) return 'null';
	if (value === undefined) return 'undefined';
	if (typeof value === 'string') return value;
	if (typeof value === 'object') return JSON.stringify(value, null, 2);
	return String(value);
}

export function toolIcon(toolPart: ToolPart): typeof Wrench {
	const type = toolPart.type.toLowerCase();
	if (isTaskToolType(type)) return CalendarClock;
	if (toolPart.serviceKind === 'mcp' || type.startsWith('mcp__')) return Plug;
	if (isAppToolType(type)) return Blocks;
	if (type === 'subagent' || type === 'subagents') return Bot;
	if (type.includes('skill')) return Sparkles;
	if (type === 'create_image') return Image;
	if (type === 'create_video') return Video;
	if (type === 'create_sound') return AudioLines;
	if (type.includes('email')) return Mail;
	if (type.startsWith('microphone_recorder') || type.startsWith('recorder_microphone')) return Mic;
	if (type.startsWith('camera_recorder') || type.startsWith('recorder_camera')) return Camera;
	if (type.startsWith('screen_recorder') || type.startsWith('recorder_screen')) return Monitor;
	if (type === 'bash') return Terminal;
	if (type === 'write') return PenLine;
	return Wrench;
}

function StatusIcon({ state }: { readonly state: ToolPart['state'] }) {
	if (state === 'output-error') {
		return <CircleX aria-label="Failed" className="size-3 shrink-0 text-destructive" />;
	}
	if (state === 'output-available') {
		return <Check aria-label="Completed" className="size-3 shrink-0 text-muted-foreground/70" />;
	}
	return (
		<LoaderCircle
			aria-label="Running"
			className="size-3 shrink-0 animate-spin text-muted-foreground"
		/>
	);
}

function ToolInput({ input }: { readonly input: unknown }) {
	if (!isRecord(input) || Object.keys(input).length === 0) return null;

	return (
		<div>
			<h4 className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70">
				Input
			</h4>
			<div className="max-h-40 overflow-auto rounded-sm bg-muted/40 px-2 py-1.5 font-mono text-xs text-muted-foreground">
				{Object.entries(input).map(([key, value]) => (
					<div key={key} className="mb-0.5 break-words last:mb-0">
						<span className="text-foreground/70">{key}:</span> <span>{formatValue(value)}</span>
					</div>
				))}
			</div>
		</div>
	);
}

function delegationResult(output: unknown): unknown {
	if (typeof output !== 'string') return output;
	try {
		return JSON.parse(output);
	} catch {
		return output;
	}
}

function DelegationOutput({ output }: { readonly output: unknown }) {
	const result = delegationResult(output);
	const outcomes = Array.isArray(result) ? result : [result];
	const statuses = outcomes.reduce<Record<string, number>>((summary, outcome) => {
		const status =
			isRecord(outcome) && typeof outcome.status === 'string' ? outcome.status : 'completed';
		summary[status] = (summary[status] ?? 0) + 1;
		return summary;
	}, {});
	const text = outcomes
		.map((outcome) => (isRecord(outcome) && typeof outcome.text === 'string' ? outcome.text : ''))
		.filter(Boolean)
		.join('\n\n');

	return (
		<div>
			<h4 className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70">
				Subagent result
			</h4>
			<div className="space-y-1.5 rounded-sm bg-muted/40 px-2 py-1.5 text-xs text-muted-foreground">
				<div className="flex flex-wrap gap-x-2 gap-y-0.5">
					{Object.entries(statuses).map(([status, count]) => (
						<span key={status}>
							{count} {status}
						</span>
					))}
				</div>
				{text && <p className="whitespace-pre-wrap text-foreground/80">{text}</p>}
			</div>
		</div>
	);
}

function DelegationTasks({ input, output }: { readonly input: unknown; readonly output: unknown }) {
	if (!isRecord(input) || !Array.isArray(input.tasks)) return null;
	const outcomes = Array.isArray(delegationResult(output)) ? delegationResult(output) : [];
	const byId = new Map(
		outcomes.flatMap((outcome) =>
			isRecord(outcome) && typeof outcome.id === 'string' ? [[outcome.id, outcome]] : []
		)
	);

	return (
		<div className="mt-1 space-y-1 border-l border-border/60 pl-3" aria-label="Subagent activity">
			{input.tasks.map((task, index) => {
				const record = isRecord(task) ? task : {};
				const id = typeof record.id === 'string' ? record.id : `Subagent ${index + 1}`;
				const taskText = typeof record.task === 'string' ? record.task : '';
				const outcome = byId.get(id);
				const status =
					isRecord(outcome) && typeof outcome.status === 'string' ? outcome.status : 'working';
				const failed = status === 'failed' || status === 'cancelled' || status === 'exhausted';
				return (
					<div key={id} className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
						{status === 'working' ? (
							<LoaderCircle aria-label={`${id} working`} className="size-3 shrink-0 animate-spin" />
						) : failed ? (
							<CircleX
								aria-label={`${id} ${status}`}
								className="size-3 shrink-0 text-destructive"
							/>
						) : (
							<Check aria-label={`${id} completed`} className="size-3 shrink-0" />
						)}
						<span className="shrink-0 font-medium text-foreground/80">{id}</span>
						<span className="truncate" title={taskText}>
							{taskText || status}
						</span>
						<span className="ml-auto shrink-0 text-[10px] capitalize text-muted-foreground/70">
							{status}
						</span>
					</div>
				);
			})}
		</div>
	);
}

function ToolOutput({ output, type }: { readonly output: unknown; readonly type: string }) {
	if (output === undefined) return null;
	if (type === 'subagent' || type === 'subagents') return <DelegationOutput output={output} />;

	return (
		<div>
			<h4 className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70">
				Output
			</h4>
			<div className="max-h-60 overflow-auto rounded-sm bg-muted/40 px-2 py-1.5 font-mono text-xs text-muted-foreground">
				<pre className="whitespace-pre-wrap">{formatValue(output)}</pre>
			</div>
		</div>
	);
}

function Tool({
	toolPart,
	label,
	defaultOpen = false,
	hideIcon = false,
	className,
	style,
}: ToolProps) {
	const [isOpen, setIsOpen] = useState(defaultOpen);
	const { state, toolCallId } = toolPart;
	const input = toolPart.input ?? (toolPart.inputText ? { raw: toolPart.inputText } : undefined);
	const output = toolPart.output ?? toolPart.outputText;
	const triggerLabel = label ?? toolPart.type;
	const kindIcon = toolIcon(toolPart);
	const isExecuting =
		toolPart.durationMs === undefined &&
		toolPart.startedAtMs !== undefined &&
		(state === 'input-streaming' || state === 'input-available');
	const now = useNow(isExecuting);
	const displayDurationMs =
		toolPart.durationMs ??
		(isExecuting && toolPart.startedAtMs !== undefined
			? Math.max(0, now - toolPart.startedAtMs)
			: undefined);
	const streamingTokens =
		state === 'input-streaming' ? estimateTokens(toolPart.inputText?.length ?? 0) : 0;

	return (
		<div
			className={cn(
				'animate-in fade-in-0 slide-in-from-bottom-1 fill-mode-backwards duration-300 overflow-hidden rounded-md',
				className
			)}
			style={style}
		>
			<Collapsible open={isOpen} onOpenChange={setIsOpen}>
				<CollapsibleTrigger
					render={
						<Button
							type="button"
							variant="ghost"
							className="p-0! h-auto w-full justify-start rounded-md bg-transparent! py-1 font-normal text-muted-foreground transition-colors hover:bg-transparent hover:text-foreground"
						>
							<div className="flex w-full min-w-0 items-center gap-1.5">
								{!hideIcon &&
									createElement(kindIcon, {
										className: 'size-3.5 shrink-0 text-muted-foreground/60',
									})}
								<span
									className={cn(
										'truncate text-xs font-medium',
										label ? 'font-sans' : 'font-mono capitalize'
									)}
								>
									{triggerLabel}
								</span>
								<StatusIcon state={state} />
								{displayDurationMs !== undefined && (
									<span className="shrink-0 text-[10px] tabular-nums text-muted-foreground/50">
										{formatDuration(displayDurationMs)}
									</span>
								)}
								{streamingTokens > 0 ? (
									<span className="ml-auto shrink-0 pl-2 text-[10px] tabular-nums text-muted-foreground/50">
										~{streamingTokens.toLocaleString()} tok
									</span>
								) : (
									toolPart.outputTokens !== undefined &&
									toolPart.outputTokens > 0 && (
										<span className="ml-auto shrink-0 pl-2 text-[10px] tabular-nums text-muted-foreground/50">
											{toolPart.outputTokens.toLocaleString()} tok
										</span>
									)
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
					<div className="mb-1 mt-0.5 space-y-2 rounded-md border border-border/50 bg-muted/20 p-2">
						<ToolInput input={input} />
						<ToolOutput output={output} type={toolPart.type} />

						{state === 'output-error' && toolPart.errorText && (
							<div>
								<h4 className="mb-1 text-[10px] font-medium uppercase tracking-wider text-destructive/80">
									Error
								</h4>
								<div className="rounded-sm bg-destructive/10 px-2 py-1.5 text-xs text-destructive">
									{toolPart.errorText}
								</div>
							</div>
						)}

						{state === 'input-streaming' && (
							<div className="text-xs text-muted-foreground">Processing tool call...</div>
						)}

						{toolCallId && (
							<div className="truncate font-mono text-[10px] text-muted-foreground/60">
								{toolCallId}
							</div>
						)}
					</div>
				</CollapsibleContent>
			</Collapsible>
			{(toolPart.type === 'subagent' || toolPart.type === 'subagents') && (
				<DelegationTasks input={input} output={output} />
			)}
		</div>
	);
}

export { Tool };
