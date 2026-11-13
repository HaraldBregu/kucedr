import { useEffect, useState, type KeyboardEvent, type ReactElement, type ReactNode } from 'react';
import { MonitorUp, SquareSlash, type LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import type { AgentModeInfo } from '@shared/agent_types';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import { usePromptInput } from '@/components/ui/prompt-input';
import { SETTINGS_NAVIGATION } from '@/pages/settings/navigation';
import { cn } from '@/lib/utils';

const SETTINGS_PATHS = [
	'/settings/general',
	'/settings/cloud',
	'/settings/models',
	'/settings/library',
	'/settings/plugins',
	'/settings/modes',
];

type SlashItem = {
	readonly group: string;
	readonly label: string;
	readonly hint?: string;
	readonly icon: LucideIcon;
	readonly disabled?: boolean;
	readonly run: () => void;
};

function PromptSlash({
	modes,
	modeIds,
	onModeIdsChange,
	children,
}: {
	readonly modes: readonly AgentModeInfo[];
	readonly modeIds: readonly string[];
	readonly onModeIdsChange: (modeIds: string[]) => void;
	readonly children: ReactNode;
}): ReactElement {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const { value, setValue, triggerFileUpload, filesAccept } = usePromptInput();
	const [selected, setSelected] = useState(0);
	const [dismissed, setDismissed] = useState(false);
	const text = value.trimStart();
	const query = /^\/\S*$/.test(text) ? text.slice(1).toLowerCase() : null;

	useEffect(() => {
		setSelected(0);
		if (query === null) setDismissed(false);
	}, [query]);

	const items: SlashItem[] =
		query === null
			? []
			: [
					...modes
						.filter((mode) => !modeIds.includes(mode.id))
						.map((mode) => ({
							group: 'Modes',
							label: mode.command,
							hint: mode.title,
							icon: SquareSlash,
							run: () => onModeIdsChange([...modeIds, mode.id]),
						})),
					...SETTINGS_NAVIGATION.filter((item) => SETTINGS_PATHS.includes(item.path)).map(
						(item) => ({
							group: 'Settings',
							label: t(item.labelKey),
							icon: item.icon,
							run: () => navigate(item.path),
						})
					),
					{
						group: 'Files',
						label: 'Upload files',
						hint: filesAccept === '' ? "This model doesn't accept files." : undefined,
						icon: MonitorUp,
						disabled: filesAccept === '',
						run: triggerFileUpload,
					},
				].filter((item) => `${item.group} ${item.label}`.toLowerCase().includes(query));
	const open = items.length > 0 && !dismissed;

	const execute = (item: SlashItem): void => {
		if (item.disabled) return;
		item.run();
		setValue('');
	};

	const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
		if (!open) return;
		if (event.key === 'ArrowDown') setSelected((selected + 1) % items.length);
		else if (event.key === 'ArrowUp') setSelected((selected + items.length - 1) % items.length);
		else if (event.key === 'Enter' || event.key === 'Tab') execute(items[selected]);
		else if (event.key === 'Escape') setDismissed(true);
		else return;
		event.preventDefault();
		event.stopPropagation();
	};

	return (
		<Popover open={open} onOpenChange={(next) => !next && setDismissed(true)}>
			<PopoverAnchor asChild>
				<div onKeyDownCapture={handleKeyDown}>{children}</div>
			</PopoverAnchor>
			<PopoverContent
				side="top"
				align="start"
				sideOffset={12}
				className="w-64 p-1"
				onOpenAutoFocus={(event) => event.preventDefault()}
				onCloseAutoFocus={(event) => event.preventDefault()}
			>
				<div role="listbox" aria-label="Commands" className="max-h-72 overflow-y-auto">
					{items.map((item, index) => (
						<div key={`${item.group}-${item.label}`}>
							{item.group !== items[index - 1]?.group ? (
								<div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
									{item.group}
								</div>
							) : null}
							<button
								type="button"
								role="option"
								aria-selected={index === selected}
								ref={index === selected ? (element) => element?.scrollIntoView({ block: 'nearest' }) : undefined}
								className={cn(
									'flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm outline-none [&_svg]:size-4 [&_svg]:shrink-0',
									index === selected && 'bg-accent text-accent-foreground'
								)}
								onMouseDown={(event) => event.preventDefault()}
								onMouseEnter={() => setSelected(index)}
								onClick={() => execute(item)}
							>
								<item.icon />
								<span className="truncate">{item.label}</span>
								{item.hint ? (
									<span className="ml-auto truncate text-xs text-muted-foreground">
										{item.hint}
									</span>
								) : null}
							</button>
						</div>
					))}
				</div>
			</PopoverContent>
		</Popover>
	);
}

export { PromptSlash };
