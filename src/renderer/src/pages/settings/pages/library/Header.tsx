import React from 'react';
import { FolderOpen, FolderPlus, LayoutGrid, List, Upload } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export function LibraryHeaderActions({
	view,
	onViewChange,
	onCreateFolder,
	onOpenFolder,
	onUpload,
	disabled,
}: {
	readonly view: 'collections' | 'list';
	readonly onViewChange: (view: 'collections' | 'list') => void;
	readonly onCreateFolder: () => void;
	readonly onOpenFolder: () => void;
	readonly onUpload: () => void;
	readonly disabled: boolean;
}): React.JSX.Element {
	const { t } = useTranslation();
	return (
		<TooltipProvider delay={400}>
			<div className="flex items-center gap-2">
				<ToggleGroup
					type="single"
					value={view}
					onValueChange={(value) => {
						if (value === 'collections' || value === 'list') onViewChange(value);
					}}
					variant="default"
					size="sm"
					aria-label={t('settings.library.view')}
				>
					{[
						{ value: 'collections' as const, icon: LayoutGrid },
						{ value: 'list' as const, icon: List },
					].map(({ value, icon: Icon }) => (
						<Tooltip key={value}>
							<TooltipTrigger
								render={
									<ToggleGroupItem
										value={value}
										className="size-7 min-w-0 bg-secondary p-0 text-secondary-foreground hover:bg-secondary/80 hover:text-secondary-foreground data-[pressed]:bg-accent data-[pressed]:text-accent-foreground"
										aria-label={t(`settings.library.${value}`)}
									>
										<Icon className="size-4" />
									</ToggleGroupItem>
								}
							/>
							<TooltipContent side="bottom">{t(`settings.library.${value}`)}</TooltipContent>
						</Tooltip>
					))}
				</ToggleGroup>
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
