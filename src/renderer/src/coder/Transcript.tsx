import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { CodingSessionBlock } from '@shared/coding_types';
import { markdownComponents } from '@/pages/home/components/markdown';

export function Transcript({ blocks }: { blocks: readonly CodingSessionBlock[] }) {
	return (
		<div className="space-y-6">
			{blocks.map((block) => (
				<article key={block.id} className="min-w-0 text-sm leading-relaxed">
					<p className="mb-2 text-xs font-medium text-muted-foreground">
						{block.type === 'command' ? 'Command' : block.role === 'user' ? 'You' : 'Coder'}
					</p>
					{block.type === 'command' ? (
						<pre className="overflow-x-auto rounded-lg bg-muted p-3 text-xs">
							{block.command}
							{'\n'}
							{block.output}
						</pre>
					) : (
						<div className="break-words [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-muted [&_pre]:p-3 [&_pre]:text-xs">
							<ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
								{block.content}
							</ReactMarkdown>
						</div>
					)}
				</article>
			))}
		</div>
	);
}
