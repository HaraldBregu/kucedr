import { Check, LoaderCircle, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { markdownComponents } from '@/pages/home/components/markdown';
import type { CoderBlock } from './types';

export function Transcript({ blocks }: { blocks: readonly CoderBlock[] }) {
	return (
		<div className="space-y-4">
			{blocks.map((block) =>
				block.type === 'tool' ? (
					<div
						key={block.id}
						className="flex items-center gap-2 text-xs text-muted-foreground"
						role="status"
					>
						{block.status === 'running' ? (
							<LoaderCircle className="size-3 animate-spin" />
						) : block.status === 'failed' ? (
							<X className="size-3 text-destructive" />
						) : (
							<Check className="size-3" />
						)}
						<span>{block.toolName}</span>
						<span>{block.status}</span>
					</div>
				) : block.type === 'command' ? (
					<details key={block.id} open className="overflow-hidden rounded-lg bg-muted">
						<summary className="cursor-pointer px-3 py-2 font-mono text-xs">
							<span>{block.command}</span>
							<span className="ml-3 text-muted-foreground">
								{block.status}
								{'exitCode' in block && block.exitCode !== undefined
									? ` · exit ${block.exitCode}`
									: ''}
							</span>
						</summary>
						<pre className="max-h-80 overflow-auto whitespace-pre-wrap px-3 pb-3 text-xs leading-5">
							{block.output ||
								(block.status === 'running'
									? 'Waiting for output…'
									: 'Command produced no output.')}
						</pre>
						{block.truncated && (
							<p className="px-3 pb-2 text-xs text-muted-foreground">Output was truncated.</p>
						)}
					</details>
				) : (
					<article
						key={block.id}
						aria-label={`${block.role} message`}
						className={
							block.role === 'user'
								? 'ml-auto w-fit max-w-full rounded-lg bg-muted px-3 py-2 text-sm leading-6'
								: 'min-w-0 py-2 text-sm leading-6'
						}
					>
						{block.role === 'user' ? (
							<p className="whitespace-pre-wrap break-words">{block.content}</p>
						) : (
							<div className="break-words [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-muted [&_pre]:p-3 [&_pre]:text-xs">
								<ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
									{block.content}
								</ReactMarkdown>
							</div>
						)}
					</article>
				)
			)}
		</div>
	);
}
