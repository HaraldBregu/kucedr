import React from 'react';
import { Download, Ellipsis, SquarePen, Trash2, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function LibrarySelection({
	count,
	onStartChat,
	onDownload,
	onDelete,
	onOpenFolder,
	onClear,
	busy,
}: {
	readonly count: number;
	readonly onStartChat: () => void;
	readonly onDownload: () => void;
	readonly onDelete: () => void;
	readonly onOpenFolder: () => void;
	readonly onClear: () => void;
	readonly busy: boolean;
}): React.JSX.Element {
	const { t } = useTranslation();
	return (
		<div
			role="toolbar"
			aria-label={t('settings.library.selectionActions')}
			className="fixed bottom-6 left-1/2 z-40 flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-2 overflow-x-auto rounded-full bg-neutral-900 px-4 py-3 text-white shadow-xl sm:gap-3 sm:px-6"
		>
			<span className="mr-2 shrink-0 whitespace-nowrap text-sm sm:text-base">
				{t('settings.library.selectedCount', { count })}
			</span>
			<Button
				size="sm"
				className="shrink-0 rounded-full bg-white text-neutral-900 hover:bg-neutral-200"
				onClick={onStartChat}
				disabled={busy}
			>
				<SquarePen className="size-4" />
				{t('settings.library.startChat')}
			</Button>
			<Button
				size="sm"
				variant="outline"
				className="shrink-0 rounded-full border-neutral-600 bg-neutral-800 text-white hover:bg-neutral-700 hover:text-white"
				onClick={onDownload}
				disabled={busy}
			>
				<Download className="size-4" />
				{t('settings.library.download')}
			</Button>
			<Button
				size="sm"
				variant="destructive"
				className="shrink-0 rounded-full"
				onClick={onDelete}
				disabled={busy}
			>
				<Trash2 className="size-4" />
				{t('settings.library.deleteSelected')}
			</Button>
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button
						size="icon-sm"
						variant="ghost"
						className="shrink-0 text-white hover:bg-neutral-700 hover:text-white"
						aria-label={t('settings.library.more')}
					>
						<Ellipsis className="size-5" />
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end">
					<DropdownMenuItem onSelect={onOpenFolder}>
						{t('settings.library.openFolder')}
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
			<Button
				size="icon-sm"
				variant="ghost"
				className="shrink-0 text-white hover:bg-neutral-700 hover:text-white"
				aria-label={t('settings.library.clearSelection')}
				onClick={onClear}
			>
				<X className="size-5" />
			</Button>
		</div>
	);
}
