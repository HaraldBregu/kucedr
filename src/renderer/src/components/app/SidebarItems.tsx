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
		<nav className="shrink-0 px-2 pt-2">
			<SidebarMenu>
				<SidebarMenuItem>
					<SidebarMenuButton onClick={() => navigate('/settings/general')}>
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
					<SidebarMenuButton onClick={open} aria-keyshortcuts={isMac ? 'Meta+f' : 'Control+f'}>
						<Search className="size-4 shrink-0" />
						<span>{t('navigationBar.search')}</span>
						<CommandShortcut aria-hidden="true">{isMac ? '⌘F' : 'Ctrl+F'}</CommandShortcut>
					</SidebarMenuButton>
				</SidebarMenuItem>
			</SidebarMenu>
		</nav>
	);
}
