import { useState } from 'react';
import {
	Check,
	ChevronDown,
	Clipboard,
	LoaderCircle,
	MoreHorizontal,
	RotateCcw,
	Terminal,
	X,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { app } from '@kucedr/sdk';

import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { CodingBlock, CodingController } from '@/controller';

function MessageBlock({ block }: { block: Extract<CodingBlock, { type: 'message' }> }) {
	const content =
		block.role === 'assistant' ? (
			<div className="coding-markdown text-sm leading-6">
				<ReactMarkdown
					remarkPlugins={[remarkGfm]}
					components={{
						a: ({ href, children }) => (
							<Button
								variant="link"
								className="h-auto p-0 text-link"
								onClick={() => href && void app.openExternalUrl(href)}
							>
								{children}
							</Button>
						),
					}}
				>
					{block.content}
				</ReactMarkdown>
			</div>
		) : (
			<p className="whitespace-pre-wrap text-sm leading-6">{block.content}</p>
		);

	return (
		<article className="group px-4 py-2 sm:px-6" aria-label={`${block.role} message`}>
			<div
				className={
					block.role === 'user'
						? 'relative ml-auto max-w-2xl rounded-lg bg-muted px-3 py-2'
						: 'relative mx-auto max-w-4xl py-2'
				}
			>
				{block.status === 'streaming' ? (
					<LoaderCircle className="mb-2 size-3 animate-spin text-muted-foreground" />
				) : null}
				{content}
				{block.content ? (
					<Tooltip>
						<TooltipTrigger
							render={
								<Button
									variant="ghost"
									size="icon-sm"
									className="absolute right-0 top-0 size-6 opacity-0 transition-opacity group-hover:opacity-70 focus-visible:opacity-100"
									aria-label={`Copy ${block.role} message`}
									onClick={() => void navigator.clipboard.writeText(block.content)}
								>
									<Clipboard />
								</Button>
							}
						/>
						<TooltipContent>Copy message</TooltipContent>
					</Tooltip>
				) : null}
			</div>
		</article>
	);
}

function ToolBlock({ block }: { block: Extract<CodingBlock, { type: 'tool' }> }) {
	const icon =
		block.status === 'running' ? (
			<LoaderCircle className="size-3 animate-spin" />
		) : block.status === 'succeeded' ? (
			<Check className="size-3" />
		) : (
			<X className="size-3 text-destructive" />
		);
	return (
		<div className="px-4 py-1 sm:px-6">
			<div className="mx-auto flex max-w-4xl items-center gap-2 text-[11px] text-muted-foreground">
				{icon}
				<span className={block.status === 'failed' ? 'text-destructive' : ''}>
					{block.toolName}
				</span>
				{block.status !== 'succeeded' ? <span>· {block.status}</span> : null}
			</div>
		</div>
	);
}

function CommandBlock({
	block,
	coding,
}: {
	block: Extract<CodingBlock, { type: 'command' }>;
	coding: CodingController;
}) {
	const [open, setOpen] = useState(true);
	const failed = block.status === 'failed';
	const status =
		block.status === 'running'
			? 'running'
			: block.status === 'cancelled'
				? 'cancelled'
				: `exit ${block.exitCode ?? '?'}`;

	return (
		<div className="px-4 py-2 sm:px-6">
			<Collapsible
				open={open}
				onOpenChange={setOpen}
				className="mx-auto max-w-4xl overflow-hidden rounded-lg bg-code"
			>
				<div className="flex min-h-9 items-center gap-2 px-3">
					<Terminal className="size-3.5 shrink-0 text-command" />
					<CollapsibleTrigger className="flex min-w-0 flex-1 items-center gap-2 rounded-sm py-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring">
						<code className="truncate font-mono text-xs text-code-foreground">{block.command}</code>
						<ChevronDown
							className={`ml-auto size-3 shrink-0 text-muted-foreground transition ${open ? '' : '-rotate-90'}`}
						/>
					</CollapsibleTrigger>
					<span className={`text-[10px] ${failed ? 'text-destructive' : 'text-muted-foreground'}`}>
						{status}
					</span>
					<DropdownMenu>
						<DropdownMenuTrigger
							render={
								<Button
									variant="ghost"
									size="icon-sm"
									className="size-7"
									aria-label="Command actions"
								>
									<MoreHorizontal />
								</Button>
							}
						/>
						<DropdownMenuContent>
							<DropdownMenuItem onClick={() => void navigator.clipboard.writeText(block.command)}>
								<Clipboard /> Copy command
							</DropdownMenuItem>
							<DropdownMenuItem
								disabled={!block.output}
								onClick={() => void navigator.clipboard.writeText(block.output)}
							>
								<Clipboard /> Copy output
							</DropdownMenuItem>
							<DropdownMenuItem
								disabled={coding.runState === 'running'}
								onClick={() => {
									coding.setMode('shell');
									coding.setInput(block.command);
									document.querySelector<HTMLTextAreaElement>('#coding-composer')?.focus();
								}}
							>
								<RotateCcw /> Load command
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
				<CollapsibleContent>
					<pre className="max-h-80 overflow-auto px-3 pb-3 font-mono text-xs leading-5 whitespace-pre-wrap text-code-foreground">
						{block.output ||
							(block.status === 'running' ? 'Waiting for output…' : 'Command produced no output.')}
					</pre>
					{block.truncated ? (
						<p className="px-3 pb-2 text-[11px] text-muted-foreground">Output was truncated.</p>
					) : null}
				</CollapsibleContent>
			</Collapsible>
		</div>
	);
}

export function Blocks({ coding }: { coding: CodingController }) {
	return (
		<div className="py-2">
			{coding.blocks.map((block) =>
				block.type === 'message' ? (
					<MessageBlock key={block.id} block={block} />
				) : block.type === 'tool' ? (
					<ToolBlock key={block.id} block={block} />
				) : (
					<CommandBlock key={block.id} block={block} coding={coding} />
				)
			)}
		</div>
	);
}
