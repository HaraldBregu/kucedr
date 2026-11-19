'use client';

import { memo, useId, useMemo, useState } from 'react';
import type { Components, Options } from 'react-markdown';
import ReactMarkdown from 'react-markdown';
import { marked } from 'marked';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';
import { Check, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CodeBlock, CodeBlockCode } from '@/components/ui/code-block';
import { cn } from '@/lib/utils';

export type MarkdownProps = {
	children: string;
	id?: string;
	className?: string;
	components?: Partial<Components>;
	urlTransform?: Options['urlTransform'];
};

function parseMarkdownIntoBlocks(markdown: string): string[] {
	const tokens = marked.lexer(markdown);
	return tokens.map((token) => token.raw);
}

function extractLanguage(className?: string): string {
	if (!className) return 'plaintext';
	const match = className.match(/language-(\w+)/);
	return match ? match[1] : 'plaintext';
}

const initialComponents: Partial<Components> = {
	code: function CodeComponent({ className, children, ...props }) {
		const [copied, setCopied] = useState(false);
		const isInline =
			!props.node?.position?.start.line ||
			props.node?.position?.start.line === props.node?.position?.end.line;

		if (isInline) {
			return (
				<span
					className={cn(
						'rounded border border-border/60 bg-accent px-1 py-0.5 font-mono text-[0.85em] text-accent-foreground',
						className
					)}
					{...props}
				>
					{children}
				</span>
			);
		}

		const language = extractLanguage(className);

		return (
			<CodeBlock className={cn('relative', className)}>
				<Button
					type="button"
					variant="ghost"
					size="icon-xs"
					className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"
					aria-label="Copy code"
					title="Copy code"
					onClick={() =>
						void navigator.clipboard.writeText(String(children).replace(/\n$/, '')).then(() => {
							setCopied(true);
							setTimeout(() => setCopied(false), 1500);
						})
					}
				>
					{copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
				</Button>
				<CodeBlockCode code={String(children)} language={language} />
			</CodeBlock>
		);
	},
	pre: function PreComponent({ children }) {
		return <>{children}</>;
	},
};

const MemoizedMarkdownBlock = memo(
	function MarkdownBlock({
		content,
		components = initialComponents,
		urlTransform,
	}: {
		content: string;
		components?: Partial<Components>;
		urlTransform?: Options['urlTransform'];
	}) {
		return (
			<ReactMarkdown
				remarkPlugins={[remarkGfm, remarkBreaks]}
				components={components}
				urlTransform={urlTransform}
			>
				{content}
			</ReactMarkdown>
		);
	},
	function propsAreEqual(prevProps, nextProps) {
		return (
			prevProps.content === nextProps.content &&
			prevProps.components === nextProps.components &&
			prevProps.urlTransform === nextProps.urlTransform
		);
	}
);

MemoizedMarkdownBlock.displayName = 'MemoizedMarkdownBlock';

function MarkdownComponent({
	children,
	id,
	className,
	components = initialComponents,
	urlTransform,
}: MarkdownProps) {
	const generatedId = useId();
	const blockId = id ?? generatedId;
	const blocks = useMemo(() => parseMarkdownIntoBlocks(children), [children]);
	const mergedComponents = useMemo(
		() =>
			components === initialComponents
				? initialComponents
				: { ...initialComponents, ...components },
		[components]
	);

	return (
		<div className={className}>
			{blocks.map((block, index) => (
				<MemoizedMarkdownBlock
					key={`${blockId}-block-${index}`}
					content={block}
					components={mergedComponents}
					urlTransform={urlTransform}
				/>
			))}
		</div>
	);
}

const Markdown = memo(MarkdownComponent);
Markdown.displayName = 'Markdown';

export { Markdown };
