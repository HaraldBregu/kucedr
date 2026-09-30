import { CircleHelp, Search, Settings } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar';
import { CommandShortcut } from '@/components/ui/command';
import { useCommandMenu } from '@/contexts/command-menu';

export function SidebarItems(): React.JSX.Element {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const { open } = useCommandMenu();
	const isMac = navigator.platform.startsWith('Mac');

	return (
		<nav className="shrink-0 border-t border-sidebar-border/50 px-2 pt-2">
			<SidebarMenu>
				<SidebarMenuItem>
					<SidebarMenuButton onClick={() => navigate('/settings/settings')}>
						<Settings className="size-4 shrink-0" />
						<span>{t('settings.title')}</span>
					</SidebarMenuButton>
				</SidebarMenuItem>
				<SidebarMenuItem>
					<SidebarMenuButton
						onClick={() => void window.app.openExternalUrl('https://www.kucedr.com/help')}
					>
						<CircleHelp className="size-4 shrink-0" />
						<span>{t('settings.sidebar.help')}</span>
					</SidebarMenuButton>
				</SidebarMenuItem>
				<SidebarMenuItem>
					<SidebarMenuButton className="group/search" onClick={open} aria-keyshortcuts={isMac ? 'Meta+f' : 'Control+f'}>
						<Search className="size-4 shrink-0" />
						<span>{t('navigationBar.search')}</span>
						<CommandShortcut className="flex items-center gap-0.5 opacity-0 group-hover/search:opacity-100" aria-hidden="true">
							<kbd className="flex h-5 min-w-5 items-center justify-center rounded-md border border-border bg-background px-1 text-[11px] text-foreground shadow-sm">
								{isMac ? '⌘' : 'Ctrl'}
							</kbd>
							<kbd className="flex h-5 min-w-5 items-center justify-center rounded-md border border-border bg-background px-1 text-[11px] text-foreground shadow-sm">
								F
							</kbd>
						</CommandShortcut>
					</SidebarMenuButton>
				</SidebarMenuItem>
			</SidebarMenu>
		</nav>
	);
}
