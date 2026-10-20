import { Plug, Settings } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { playSound } from '@/lib/sounds/play';
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar';

export function SidebarItems(): React.JSX.Element {
	const { t } = useTranslation();
	const navigate = useNavigate();

	return (
		<nav className="shrink-0 border-t border-sidebar-border/50 px-2 pt-2">
			<SidebarMenu>
				<SidebarMenuItem>
					<SidebarMenuButton onClick={() => {
						playSound('navigate');
						navigate('/settings/settings');
					}}>
						<Settings className="size-4 shrink-0" strokeWidth={1.8} />
						<span>{t('settings.title')}</span>
					</SidebarMenuButton>
				</SidebarMenuItem>
				<SidebarMenuItem>
					<SidebarMenuButton onClick={() => {
						playSound('navigate');
						navigate('/settings/plugins');
					}}>
						<Plug className="size-4 shrink-0" strokeWidth={1.8} />
						<span>{t('settings.tabs.plugins')}</span>
					</SidebarMenuButton>
				</SidebarMenuItem>
			</SidebarMenu>
		</nav>
	);
}
