import {
	CircleHelp,
	Layers,
	LogOut,
	MoreVertical,
	RadioTower,
	Server,
	Settings,
	UserRound,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
	SidebarFooter,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from '@/components/ui/sidebar';
import { useAuth } from '@/contexts/AuthContext';

export function AppSidebarFooter(): React.JSX.Element {
	const { t } = useTranslation();
	const { state: authState } = useAuth();
	const authenticatedUser = authState.status === 'signedIn' ? authState.user : undefined;
	const accountItem = {
		title: authenticatedUser ? t('settings.tabs.account') : t('settings.title'),
		description: authenticatedUser?.email ?? t('settings.sidebar.summary'),
		avatarPath: authenticatedUser?.avatarPath,
	};
	const accountInitial = accountItem.title.charAt(0).toUpperCase();
	const menuItems = [
		{ path: '/settings/account', label: t('settings.tabs.account'), icon: UserRound },
		{ path: '/settings/providers', label: t('settings.sidebar.provider'), icon: Server },
		{ path: '/settings/channels', label: t('settings.tabs.channels'), icon: RadioTower },
		{ path: '/settings/apps', label: t('settings.tabs.apps'), icon: Layers },
		{ path: '/settings/general', label: t('settings.title'), icon: Settings },
	];

	return (
		<SidebarFooter className="shrink-0 border-t border-sidebar-border/50">
			<SidebarMenu>
				<SidebarMenuItem>
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<SidebarMenuButton
								size="lg"
								aria-label={t('settings.sidebar.accountMenu', { name: accountItem.title })}
								className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
							>
								<Avatar className="size-8 rounded-full grayscale">
									<AvatarImage src={accountItem.avatarPath} alt={accountItem.title} />
									<AvatarFallback className="rounded-full bg-accent text-accent-foreground">
										{accountInitial}
									</AvatarFallback>
								</Avatar>
								<span className="min-w-0 flex-1 truncate text-left text-sm font-medium">
									{accountItem.title}
								</span>
								<MoreVertical className="ml-auto size-4" aria-hidden="true" />
							</SidebarMenuButton>
						</DropdownMenuTrigger>
						<DropdownMenuContent
							className="w-[var(--radix-dropdown-menu-trigger-width)]"
							side="top"
							align="start"
						>
							<DropdownMenuLabel className="p-0 font-normal">
								<div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
									<Avatar className="size-8 rounded-full">
										<AvatarImage src={accountItem.avatarPath} alt={accountItem.title} />
										<AvatarFallback className="rounded-full bg-accent text-accent-foreground">
											{accountInitial}
										</AvatarFallback>
									</Avatar>
									<div className="grid min-w-0 flex-1 text-left text-xs leading-tight">
										<span className="truncate font-medium">{accountItem.title}</span>
										{accountItem.description ? (
											<span className="truncate text-xs text-muted-foreground">
												{accountItem.description}
											</span>
										) : null}
									</div>
								</div>
							</DropdownMenuLabel>
							<DropdownMenuSeparator />
							<DropdownMenuGroup>
								{menuItems.map((item) => {
									const Icon = item.icon;
									return (
										<DropdownMenuItem key={item.path} asChild>
											<Link to={item.path}>
												<Icon />
												{item.label}
											</Link>
										</DropdownMenuItem>
									);
								})}
							</DropdownMenuGroup>
							<DropdownMenuItem
								onSelect={() => void window.app.openExternalUrl('https://www.kucedr.com/help')}
							>
								<CircleHelp />
								{t('settings.sidebar.getHelp')}
							</DropdownMenuItem>
							{authenticatedUser ? (
								<>
									<DropdownMenuSeparator />
									<DropdownMenuItem
										onSelect={() => {
											void window.win.confirmSignOut().then((confirmed) => {
												if (confirmed) void window.auth.signOut();
											});
										}}
									>
										<LogOut />
										{t('settings.sidebar.signOut')}
									</DropdownMenuItem>
								</>
							) : null}
						</DropdownMenuContent>
					</DropdownMenu>
				</SidebarMenuItem>
			</SidebarMenu>
		</SidebarFooter>
	);
}
