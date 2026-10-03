import { Code2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';

export function CodeEmpty(): React.JSX.Element {
	const { t } = useTranslation();
	return (
		<Empty className="h-full min-h-0 overflow-y-auto rounded-none">
			<EmptyHeader>
				<EmptyMedia className="relative mb-4 w-56 max-w-full">
					<svg viewBox="0 0 240 172" role="img" aria-label={t('codeEmpty.image', 'Illustration of a workspace folder and code files')} className="w-full text-muted-foreground" fill="none">
						<ellipse cx="120" cy="151" rx="88" ry="9" className="fill-muted" />
						<path d="M32 72a10 10 0 0 1 10-10h48l14 14h88a10 10 0 0 1 10 10v53a10 10 0 0 1-10 10H42a10 10 0 0 1-10-10Z" className="fill-muted stroke-border" strokeWidth="1.5" />
						<g transform="rotate(-9 91 78)">
							<rect x="58" y="29" width="70" height="98" rx="8" className="fill-background stroke-border" strokeWidth="1.5" />
							<path d="M73 49h28M73 61h40M73 73h33M73 85h40" stroke="currentColor" strokeOpacity=".3" strokeWidth="3" strokeLinecap="round" />
						</g>
						<g transform="rotate(7 155 77)">
							<rect x="116" y="24" width="78" height="106" rx="8" className="fill-background stroke-border" strokeWidth="1.5" />
							<path d="m141 49-9 9 9 9m27-18 9 9-9 9m-10-23-7 29" className="stroke-primary" strokeOpacity=".65" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
							<path d="M133 87h43M133 98h30" stroke="currentColor" strokeOpacity=".25" strokeWidth="3" strokeLinecap="round" />
						</g>
						<path d="M38 96h164a8 8 0 0 1 8 10l-9 34a12 12 0 0 1-12 9H49a12 12 0 0 1-12-9l-7-34a8 8 0 0 1 8-10Z" className="fill-muted stroke-border" strokeWidth="1.5" />
						<path d="M104 122h32" stroke="currentColor" strokeOpacity=".25" strokeWidth="3" strokeLinecap="round" />
					</svg>
					<div className="absolute bottom-0 right-3 flex size-10 items-center justify-center rounded-xl border bg-background text-muted-foreground"><Code2 className="size-5" aria-hidden="true" /></div>
				</EmptyMedia>
				<EmptyTitle>{t('navigationBar.code', 'Code')}</EmptyTitle>
				<EmptyDescription>{t('codeEmpty.description', 'Create a workspace or select a file from the sidebar.')}</EmptyDescription>
			</EmptyHeader>
		</Empty>
	);
}
