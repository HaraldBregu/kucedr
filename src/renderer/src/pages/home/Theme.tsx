import { useEffect, useState, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Palette } from 'lucide-react';
import type { PluginTheme } from '@shared/plugin_types';
import { Button } from '@/components/ui/button';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useApp } from '@/contexts';

type Selection = { pluginId: string; themeId: string } | null;

export function Theme({ compact = false }: { compact?: boolean }): ReactElement {
	const { t } = useTranslation();
	const { theme, setTheme } = useApp();
	const [themes, setThemes] = useState<PluginTheme[]>([]);
	const [selected, setSelected] = useState<Selection>(null);

	useEffect(() => {
		let active = true;
		const load = (): void => {
			void Promise.all([window.app.themes(), window.app.getSelectedTheme()]).then(([items, selection]) => {
				if (!active) return;
				setThemes(items.filter((item) => item.enabled));
				setSelected(selection);
			});
		};
		load();
		const off = window.app.onThemesChanged(load);
		return () => {
			active = false;
			off();
		};
	}, []);

	const select = (next: Selection): void => {
		void window.app.setSelectedTheme(next).then(() => setSelected(next));
	};
	const active = themes.find((item) => item.plugin.id === selected?.pluginId && item.id === selected.themeId);
	const mark = (on: boolean): ReactElement => <Check className={on ? 'size-4' : 'size-4 opacity-0'} />;

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					type="button"
					variant="ghost"
					aria-label={t('settings.theme.appearance')}
					className={compact ? 'h-7 rounded-md px-2 text-xs' : 'h-9 rounded-full px-2 text-sm'}
				>
					<Palette className="size-4" />
					{compact ? null : (active?.title ?? t('settings.theme.default'))}
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end">
				<DropdownMenuItem onSelect={() => select(null)}>
					{mark(!active)}
					{t('settings.theme.default')}
				</DropdownMenuItem>
				{themes.map((item) => (
					<DropdownMenuItem
						key={`${item.plugin.id}/${item.id}`}
						onSelect={() => select({ pluginId: item.plugin.id, themeId: item.id })}
					>
						{mark(item === active)}
						{item.title} · {item.plugin.name}
					</DropdownMenuItem>
				))}
				<DropdownMenuSeparator />
				{(['system', 'light', 'dark'] as const).map((mode) => (
					<DropdownMenuItem key={mode} onSelect={() => setTheme(mode)}>
						{mark(theme === mode)}
						{t(`settings.theme.${mode}`)}
					</DropdownMenuItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
