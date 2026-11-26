import { cn } from '@/lib/utils';
import { useIsDark } from '@/hooks/use-is-dark';
import React, { useEffect, useState } from 'react';

export type CodeBlockProps = {
	children?: React.ReactNode;
	className?: string;
} & React.HTMLProps<HTMLDivElement>;

function CodeBlock({ children, className, ...props }: CodeBlockProps) {
	return (
		<div
			className={cn(
				'not-prose flex w-full flex-col overflow-clip border',
				'border-border bg-card text-card-foreground rounded-xl',
				className
			)}
			{...props}
		>
			{children}
		</div>
	);
}

export type CodeBlockCodeProps = {
	code: string;
	language?: string;
	theme?: string;
	className?: string;
} & React.HTMLProps<HTMLDivElement>;

function CodeBlockCode({ code, language = 'tsx', theme, className, ...props }: CodeBlockCodeProps) {
	const isDark = useIsDark();
	const activeTheme = theme ?? (isDark ? 'github-dark' : 'github-light');
	const highlightKey = `${activeTheme}\u0000${language}\u0000${code}`;
	const [highlighted, setHighlighted] = useState<{ key: string; html: string } | null>(null);

	useEffect(() => {
		if (!code) return;
		let cancelled = false;
		void import('shiki')
			.then(({ codeToHtml }) => codeToHtml(code, { lang: language, theme: activeTheme }))
			.then((html) => {
				if (!cancelled) setHighlighted({ key: highlightKey, html });
			})
			.catch(() => undefined);
		return () => {
			cancelled = true;
		};
	}, [activeTheme, code, highlightKey, language]);

	const highlightedHtml = highlighted?.key === highlightKey ? highlighted.html : null;

	const classNames = cn(
		'w-full overflow-x-auto bg-code text-13 text-code-foreground [&>pre]:min-w-full [&>pre]:w-max [&>pre]:!bg-transparent [&>pre]:px-4 [&>pre]:py-4',
		className
	);

	// SSR fallback: render plain code if not hydrated yet
	return highlightedHtml ? (
		<div className={classNames} dangerouslySetInnerHTML={{ __html: highlightedHtml }} {...props} />
	) : (
		<div className={classNames} {...props}>
			<pre>
				<code>{code}</code>
			</pre>
		</div>
	);
}

export type CodeBlockGroupProps = React.HTMLAttributes<HTMLDivElement>;

function CodeBlockGroup({ children, className, ...props }: CodeBlockGroupProps) {
	return (
		<div className={cn('flex items-center justify-between', className)} {...props}>
			{children}
		</div>
	);
}

export { CodeBlockGroup, CodeBlockCode, CodeBlock };
