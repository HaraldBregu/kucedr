import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { app, isKucedr } from '@kucedr/sdk';

import { showNativeContextMenu } from '@/lib/menu';
import { workspaceResourceUrl } from '@/lib/resource';

interface MarkdownPreviewProps {
	canSave: boolean;
	content: string;
	onSave: () => Promise<boolean>;
	path: string;
}

export function MarkdownPreview({ canSave, content, onSave, path }: MarkdownPreviewProps) {
	return (
		<article
			className="mx-auto min-h-full w-full max-w-[920px] px-5 pb-16 pt-8 text-[15px] leading-7 text-foreground sm:px-8 lg:px-12 [&_a]:font-medium [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-4 [&_blockquote]:my-5 [&_blockquote]:border-l-4 [&_blockquote]:border-border [&_blockquote]:pl-4 [&_blockquote]:text-muted-foreground [&_code]:rounded [&_code]:bg-muted [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.9em] [&_h1]:mb-5 [&_h1]:mt-2 [&_h1]:text-3xl [&_h1]:font-bold [&_h1]:tracking-tight [&_h2]:mb-4 [&_h2]:mt-8 [&_h2]:border-b [&_h2]:pb-2 [&_h2]:text-2xl [&_h2]:font-semibold [&_h3]:mb-3 [&_h3]:mt-6 [&_h3]:text-xl [&_h3]:font-semibold [&_h4]:mb-2 [&_h4]:mt-5 [&_h4]:text-lg [&_h4]:font-semibold [&_hr]:my-8 [&_hr]:border-border [&_img]:my-6 [&_img]:max-w-full [&_img]:rounded-lg [&_img]:border [&_img]:shadow-sm [&_li]:my-1 [&_ol]:my-4 [&_ol]:list-decimal [&_ol]:pl-7 [&_p]:my-4 [&_pre]:my-5 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:border [&_pre]:bg-muted [&_pre]:p-4 [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_table]:my-6 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:px-3 [&_td]:py-2 [&_th]:border [&_th]:bg-muted [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_ul]:my-4 [&_ul]:list-disc [&_ul]:pl-7"
			onContextMenu={(event) => {
				showNativeContextMenu(
					event,
					[
						{ type: 'role', role: 'copy' },
						{ type: 'role', role: 'selectAll' },
						{ type: 'separator' },
						{ id: 'save', label: 'Save', accelerator: 'CommandOrControl+S', enabled: canSave },
						{ id: 'copy-path', label: 'Copy Path' },
					],
					{
						save: async () => {
							await onSave();
						},
						'copy-path': () => navigator.clipboard.writeText(path),
					}
				);
			}}
		>
			<ReactMarkdown
				remarkPlugins={[remarkGfm]}
				skipHtml
				components={{
					a: ({ children, href }) =>
						href ? (
							<a
								href={href}
								target="_blank"
								rel="noreferrer"
								onClick={(event) => {
									if (!isKucedr()) return;
									event.preventDefault();
									void app.openExternalUrl(href);
								}}
							>
								{children}
							</a>
						) : (
							<span className="font-medium text-primary">{children}</span>
						),
				}}
				urlTransform={(url, key) =>
					key === 'src'
						? workspaceResourceUrl(url, path)
						: /^(https?:|mailto:)/i.test(url)
							? url
							: ''
				}
			>
				{content}
			</ReactMarkdown>
		</article>
	);
}
