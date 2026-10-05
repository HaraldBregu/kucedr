import React from 'react';
import { ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';

export function LibraryPath({
	folder,
	onNavigate,
}: {
	readonly folder: string;
	readonly onNavigate: (folder: string) => void;
}): React.JSX.Element {
	const { t } = useTranslation();
	const parts = folder ? folder.split('/') : [];
	return (
		<nav aria-label={t('settings.library.folderNavigation')} className="flex min-w-0 items-center gap-1 overflow-x-auto pb-1 text-sm">
			<Button variant="ghost" size="sm" className="shrink-0" aria-current={!folder ? 'page' : undefined} onClick={() => onNavigate('')}>
				{t('library.title')}
			</Button>
			{parts.map((part, index) => {
				const path = parts.slice(0, index + 1).join('/');
				return <React.Fragment key={path}>
					<ChevronRight className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
					<Button variant="ghost" size="sm" className="shrink-0" aria-current={index === parts.length - 1 ? 'page' : undefined} onClick={() => onNavigate(path)}>{part}</Button>
				</React.Fragment>;
			})}
		</nav>
	);
}
