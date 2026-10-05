import React, { useState, type DragEvent } from 'react';
import { ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { LIBRARY_DRAG_TYPE } from './drag';
import { libraryParent } from './parent';

export function LibraryPath({
	folder,
	onNavigate,
	onMove,
}: {
	readonly folder: string;
	readonly onNavigate: (folder: string) => void;
	readonly onMove: (paths: string[], folder: string) => void;
}): React.JSX.Element {
	const { t } = useTranslation();
	const [isDropTarget, setIsDropTarget] = useState(false);
	const parts = folder ? folder.split('/') : [];
	const parent = libraryParent(folder);
	const parentDrop = {
		onDragOver(event: DragEvent<HTMLButtonElement>) {
			if (!event.dataTransfer.types.includes(LIBRARY_DRAG_TYPE)) return;
			event.preventDefault();
			event.stopPropagation();
			event.dataTransfer.dropEffect = 'move';
			setIsDropTarget(true);
		},
		onDragLeave(event: DragEvent<HTMLButtonElement>) {
			if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
				setIsDropTarget(false);
			}
		},
		onDrop(event: DragEvent<HTMLButtonElement>) {
			if (!event.dataTransfer.types.includes(LIBRARY_DRAG_TYPE)) return;
			event.preventDefault();
			event.stopPropagation();
			setIsDropTarget(false);
			try {
				const paths: unknown = JSON.parse(event.dataTransfer.getData(LIBRARY_DRAG_TYPE));
				if (
					Array.isArray(paths) &&
					paths.length > 0 &&
					paths.every((path) => typeof path === 'string' && libraryParent(path) === folder)
				) {
					onMove(paths, parent);
				}
			} catch {
				return;
			}
		},
	};
	return (
		<nav
			aria-label={t('settings.library.folderNavigation')}
			className="flex min-w-0 items-center gap-1 overflow-x-auto pb-1 text-sm"
		>
			<Button
				variant="ghost"
				size="sm"
				className={cn('shrink-0', folder && !parent && isDropTarget && 'bg-primary/10 ring-2 ring-primary/60')}
				aria-current={!folder ? 'page' : undefined}
				onClick={() => onNavigate('')}
				{...(folder && !parent ? parentDrop : {})}
			>
				{t('library.title')}
			</Button>
			{parts.map((part, index) => {
				const path = parts.slice(0, index + 1).join('/');
				return (
					<React.Fragment key={path}>
						<ChevronRight className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
						<Button
							variant="ghost"
							size="sm"
							className={cn('shrink-0', path === parent && isDropTarget && 'bg-primary/10 ring-2 ring-primary/60')}
							aria-current={index === parts.length - 1 ? 'page' : undefined}
							onClick={() => onNavigate(path)}
							{...(path === parent ? parentDrop : {})}
						>
							{part}
						</Button>
					</React.Fragment>
				);
			})}
		</nav>
	);
}
