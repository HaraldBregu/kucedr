import { useEffect, useState, type KeyboardEvent, type ReactElement, type ReactNode } from 'react';
import { AppWindow, Check, Globe, Layers, ListTodo, MonitorUp, Palette, Sparkles, SquareSlash, type LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import type { AgentModeInfo } from '@shared/agent_types';
import type { App } from '@shared/installed_app_types';
import type { PluginTheme } from '@shared/plugin_types';
import type { SkillInfo } from '@shared/skills_types';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import { usePromptInput } from '@/components/ui/prompt-input';
import { useOpenApp } from '@/hooks/app';
import { TASK_COMMANDS } from '@/pages/home/hooks/commands';
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
	readonly description?: string;
	readonly icon: LucideIcon;
	readonly disabled?: boolean;
	readonly checked?: boolean;
	readonly run?: () => void;
	readonly insert?: string;
};

function PromptSlash({
	modes,
	modeIds,
	onModeIdsChange,
	skillIds,
	children,
}: {
	readonly modes: readonly AgentModeInfo[];
	readonly modeIds: readonly string[];
	readonly onModeIdsChange: (modeIds: string[]) => void;
	readonly skillIds: readonly string[];
	readonly children: ReactNode;
}): ReactElement {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const openApp = useOpenApp();
	const { value, setValue, triggerFileUpload, filesAccept } = usePromptInput();
	const [selected, setSelected] = useState(0);
	const [dismissed, setDismissed] = useState(false);
	const [apps, setApps] = useState<App[]>([]);
	const [skills, setSkills] = useState<SkillInfo[]>([]);
	const [themes, setThemes] = useState<PluginTheme[]>([]);
	const [sidebarTranslucency, setSidebarTranslucency] = useState<boolean | null>(null);
	const [selectedTheme, setSelectedTheme] = useState<{ pluginId: string; themeId: string } | null>(null);
	const text = value.trimStart();
	const query = /^\/\S*$/.test(text) ? text.slice(1).toLowerCase() : null;

	useEffect(() => {
		setSelected(0);
		if (query === null) setDismissed(false);
	}, [query]);

	const active = query !== null;
	useEffect(() => {
		if (!active) return;
		void window.apps
			.list()
			.then(setApps)
			.catch(() => setApps([]));
		void window.skills
			.list()
			.then((items) => setSkills(items.filter((skill) => !skill.diagnostics?.some((issue) => issue.level === 'error'))))
			.catch(() => setSkills([]));
	}, [active]);

	useEffect(() => {
		let active = true;
		const load = (): void => {
			void Promise.all([window.app.themes(), window.app.getSelectedTheme()]).then(([items, selection]) => {
				if (!active) return;
				setThemes(items.filter((item) => item.enabled));
				setSelectedTheme(selection);
			});
		};
		load();
		const off = window.app.onThemesChanged(load);
		void window.app.getSidebarTranslucency().then((enabled) => {
			if (active) setSidebarTranslucency(enabled);
		});
		const offTranslucency = window.app.onThemeModeChanged((data) => {
			setSidebarTranslucency(data.colors['sidebar-translucency-opacity'] !== '1');
		});
		return () => {
			active = false;
			off();
			offTranslucency();
		};
	}, []);

	const activeTheme = themes.find(
		(item) => item.plugin.id === selectedTheme?.pluginId && item.id === selectedTheme.themeId
	);
	const chooseTheme = (next: { pluginId: string; themeId: string } | null): void => {
		void window.app.setSelectedTheme(next).then(() => setSelectedTheme(next));
	};

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
					...skills.map((skill) => {
						const on = skillIds.some((id) => id.toLowerCase() === skill.id.toLowerCase());
						return {
							group: t('slash.skills'),
							label: skill.name,
							description: skill.description,
							icon: Sparkles,
							checked: on,
							insert: on ? `/skill off ${skill.id} ` : `/skill ${skill.id} `,
						};
					}),
					...Object.keys(TASK_COMMANDS).map((command) => ({
						group: t('slash.tasks'),
						label: command,
						description: t(`taskCommands.about.${command.slice(1)}`),
						icon: ListTodo,
						insert: `${command} `,
					})),
					...apps.map((app) => ({
						group: 'Apps',
						label: app.title,
						icon: AppWindow,
						run: () => void openApp(app),
					})),
					{
						group: 'Apps',
						label: 'Browser',
						icon: Globe,
						run: () => window.dispatchEvent(new Event('kucedr:show-browser')),
					},
					...SETTINGS_NAVIGATION.filter((item) => SETTINGS_PATHS.includes(item.path)).map(
						(item) => ({
							group: 'Settings',
							label: t(item.labelKey),
							icon: item.icon,
							run: () => navigate(item.path),
						})
					),
					...(navigator.platform.startsWith('Mac') ? [{
						group: 'Settings',
						label: t('settings.application.sidebarTranslucency'),
						icon: Layers,
						checked: sidebarTranslucency ?? false,
						disabled: sidebarTranslucency === null,
						run: () => {
							const next = !sidebarTranslucency;
							setSidebarTranslucency(next);
							void window.app.setSidebarTranslucency(next).catch(() => setSidebarTranslucency(!next));
						},
					}] : []),
					{
						group: 'Theme',
						label: t('settings.theme.default'),
						hint: activeTheme ? undefined : 'Active',
						icon: Palette,
						run: () => chooseTheme(null),
					},
					...themes.map((item) => ({
						group: 'Theme',
						label: `${item.title} · ${item.plugin.name}`,
						hint: item === activeTheme ? 'Active' : undefined,
						icon: Palette,
						run: () => chooseTheme({ pluginId: item.plugin.id, themeId: item.id }),
					})),
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
		item.run?.();
		setValue(item.insert ?? '');
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
								aria-disabled={item.disabled}
								ref={index === selected ? (element) => element?.scrollIntoView({ block: 'nearest' }) : undefined}
								className={cn(
									'flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm outline-none [&_svg]:size-4 [&_svg]:shrink-0',
									index === selected && 'bg-accent text-accent-foreground',
									item.disabled && 'opacity-50'
								)}
								onMouseDown={(event) => event.preventDefault()}
								onMouseEnter={() => setSelected(index)}
								onClick={() => execute(item)}
							>
								<item.icon />
								<span className="flex min-w-0 flex-col">
									<span className="truncate">{item.label}</span>
									{item.description ? (
										<span className="truncate text-xs text-muted-foreground">{item.description}</span>
									) : null}
								</span>
								{item.checked && (
									<Check aria-hidden="true" className="ml-auto" />
								)}
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
