import { CircleHelp, Settings } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar';

export function SidebarItems(): React.JSX.Element {
	const { t } = useTranslation();
	const navigate = useNavigate();

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
			</SidebarMenu>
		</nav>
	);
}
