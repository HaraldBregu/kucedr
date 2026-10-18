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
						<span>{t('settings.title')}</span>
					</SidebarMenuButton>
				</SidebarMenuItem>
			</SidebarMenu>
		</nav>
	);
}
