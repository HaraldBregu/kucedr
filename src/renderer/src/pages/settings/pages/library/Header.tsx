import React from 'react';
import { Check, FolderOpen, FolderPlus, LayoutGrid, List, SquarePen, Upload } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { ButtonGroup } from '@/components/ui/button-group';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export function LibraryHeaderActions({
	view,
	onViewChange,
	onCreateFolder,
	onOpenFolder,
	onUpload,
	editing,
	onEditingChange,
	disabled,
}: {
	readonly view: 'collections' | 'list';
	readonly onViewChange: (view: 'collections' | 'list') => void;
	readonly onCreateFolder: () => void;
	readonly onOpenFolder: () => void;
	readonly onUpload: () => void;
	readonly editing: boolean;
	readonly onEditingChange: (editing: boolean) => void;
	readonly disabled: boolean;
}): React.JSX.Element {
	const { t } = useTranslation();
	return (
		<TooltipProvider delay={400}>
			<div className="flex items-center gap-2">
				{view === 'list' && (
					<Tooltip>
						<TooltipTrigger
							render={
								<Button
									type="button"
									variant={editing ? 'default' : 'secondary'}
									size="icon-sm"
									aria-label={editing ? t('settings.library.done', 'Done') : t('settings.library.edit', 'Edit')}
									aria-pressed={editing}
									onClick={() => onEditingChange(!editing)}
								>
									{editing ? <Check className="size-4" /> : <SquarePen className="size-4" />}
								</Button>
							}
						/>
						<TooltipContent side="bottom">{editing ? t('settings.library.done', 'Done') : t('settings.library.edit', 'Edit')}</TooltipContent>
					</Tooltip>
				)}
				<ButtonGroup aria-label={t('settings.library.view')}>
					{[
						{ value: 'collections' as const, icon: LayoutGrid },
						{ value: 'list' as const, icon: List },
					].map(({ value, icon: Icon }) => (
						<Tooltip key={value}>
							<TooltipTrigger
								render={
									<Button
										type="button"
										variant="outline"
										className={view === value ? 'bg-accent text-accent-foreground' : undefined}
										size="icon-sm"
										aria-label={t(`settings.library.${value}`)}
										aria-pressed={view === value}
										onClick={() => onViewChange(value)}
									>
										<Icon className="size-4" />
									</Button>
								}
							/>
							<TooltipContent side="bottom">{t(`settings.library.${value}`)}</TooltipContent>
						</Tooltip>
					))}
				</ButtonGroup>
				{(
					[
						{ key: 'createFolder', icon: FolderPlus, action: onCreateFolder, disabled },
						{ key: 'openFolder', icon: FolderOpen, action: onOpenFolder, disabled: false },
						{ key: 'upload', icon: Upload, action: onUpload, disabled },
					] as const
				).map(({ key, icon: Icon, action, disabled: isDisabled }) => (
					<Tooltip key={key}>
						<TooltipTrigger
							render={
								<Button
									variant="secondary"
									size="icon-sm"
									aria-label={t(`settings.library.${key}`)}
									disabled={isDisabled}
									onClick={action}
								>
									<Icon className="size-4" />
								</Button>
							}
						/>
						<TooltipContent side="bottom">{t(`settings.library.${key}`)}</TooltipContent>
					</Tooltip>
				))}
			</div>
		</TooltipProvider>
	);
}
