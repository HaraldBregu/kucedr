import type { Components } from 'react-markdown';
import { handleExternalLinkClick, isExternalHref } from '@/lib/external-links';

function markdownLink(className: string): NonNullable<Components['a']> {
	return function MarkdownLink({ children, href }) {
		return (
			<a
				href={href}
				target={isExternalHref(href) ? '_blank' : undefined}
				rel={isExternalHref(href) ? 'noreferrer' : undefined}
				onClick={(event) => handleExternalLinkClick(event, href)}
				className={className}
			>
				{children}
			</a>
		);
	};
}

export const markdownComponents: Partial<Components> = {
	p: ({ children }) => <p className="my-2 first:mt-0 last:mb-0">{children}</p>,
	ul: ({ children }) => <ul className="my-2 list-disc space-y-1 pl-5 last:mb-0">{children}</ul>,
	ol: ({ children }) => <ol className="my-2 list-decimal space-y-1 pl-5 last:mb-0">{children}</ol>,
	li: ({ children }) => <li className="pl-1">{children}</li>,
	a: markdownLink(
		'font-medium text-link underline decoration-link/30 underline-offset-4 hover:opacity-80'
	),
	blockquote: ({ children }) => (
		<blockquote className="my-3 border-l-2 border-border pl-3 italic text-muted-foreground">
			{children}
		</blockquote>
	),
	h1: ({ children }) => <h1 className="mb-2 mt-1 text-xl font-semibold">{children}</h1>,
	h2: ({ children }) => <h2 className="mb-2 mt-1 text-lg font-semibold">{children}</h2>,
	h3: ({ children }) => <h3 className="mb-2 mt-1 text-base font-semibold">{children}</h3>,
	h4: ({ children }) => <h4 className="mb-2 mt-1 text-sm font-semibold">{children}</h4>,
	h5: ({ children }) => <h5 className="mb-2 mt-1 text-[13px] font-semibold">{children}</h5>,
	h6: ({ children }) => (
		<h6 className="mb-2 mt-1 text-[11px] font-semibold uppercase text-muted-foreground">{children}</h6>
	),
	hr: () => <hr className="my-4 border-border" />,
	table: ({ children }) => (
		<div className="my-3 overflow-x-auto rounded-md border border-border">
			<table className="w-full border-collapse text-left text-[12px]">{children}</table>
		</div>
	),
	thead: ({ children }) => <thead className="bg-muted/60">{children}</thead>,
	th: ({ children }) => (
		<th className="border-b border-border px-3 py-2 font-semibold">{children}</th>
	),
	td: ({ children }) => <td className="border-t border-border px-3 py-2">{children}</td>,
};

export const userMarkdownComponents: Partial<Components> = {
	p: ({ children }) => <p className="m-0 whitespace-pre-wrap">{children}</p>,
	a: markdownLink(
		'font-medium text-link-on-primary underline decoration-link-on-primary/40 underline-offset-4 hover:opacity-80'
	),
};
