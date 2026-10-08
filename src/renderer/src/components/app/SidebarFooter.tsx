import {
	AudioLines,
	HardDrive,
	Layers,
	Library,
	LogOut,
	MessageCircle,
	Plug,
	Server,
	UserRound,
} from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
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
import { useChatSession } from '@/contexts/chat-session';
import { ensureAppMicrophoneAccess } from '@/pages/home/hooks/audio';

export function AppSidebarFooter(): React.JSX.Element {
	const { t } = useTranslation();
	const { state: authState } = useAuth();
	const { sessionId } = useChatSession();
	const [voiceError, setVoiceError] = useState<string | null>(null);
	const authenticatedUser = authState.status === 'signedIn' ? authState.user : undefined;
	const accountItem = {
		title: authenticatedUser ? t('settings.tabs.account') : t('settings.title'),
		description: authenticatedUser?.email ?? t('settings.sidebar.summary'),
		avatarPath: authenticatedUser?.avatarPath,
	};
	const accountInitial = accountItem.title.charAt(0).toUpperCase();
	const menuItems = [
		{ path: '/settings/account', label: t('settings.tabs.account'), icon: UserRound },
		{ path: '/settings/storage', label: t('settings.tabs.storage'), icon: HardDrive },
		{ path: '/settings/agent', label: t('settings.sidebar.chatSettings'), icon: MessageCircle },
		{ path: '/settings/providers', label: t('settings.tabs.providers'), icon: Server },
		{ path: '/settings/library', label: t('library.title'), icon: Library },
		{ path: '/settings/plugins', label: t('settings.tabs.plugins'), icon: Plug },
		{ path: '/settings/apps', label: t('settings.tabs.apps'), icon: Layers },
	];

	return (
		<SidebarFooter className="shrink-0 px-2 pt-1 pb-3">
			<SidebarMenu>
				<SidebarMenuItem>
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<SidebarMenuButton
								size="lg"
								aria-label={t('settings.sidebar.accountMenu', { name: accountItem.title })}
								className="pr-11 data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
							>
								<Avatar className="size-7 rounded-md grayscale">
									<AvatarImage src={accountItem.avatarPath} alt={accountItem.title} />
									<AvatarFallback className="rounded-md bg-primary text-primary-foreground dark:bg-accent dark:text-accent-foreground">
										{accountInitial}
									</AvatarFallback>
								</Avatar>
								<span className="min-w-0 flex-1 truncate text-left text-sm font-medium">
									{accountItem.title}
								</span>
							</SidebarMenuButton>
						</DropdownMenuTrigger>
						<Button
							type="button"
							variant="ghost"
							size="icon"
							className="absolute right-2 top-2 z-10 shrink-0 rounded-lg hover:bg-sidebar-primary hover:text-sidebar-primary-foreground focus-visible:bg-sidebar-primary focus-visible:text-sidebar-primary-foreground"
							aria-label={t('settings.tabs.voice')}
							title={voiceError ?? t('settings.tabs.voice')}
							onClick={() => {
								setVoiceError(null);
								void ensureAppMicrophoneAccess()
									.then(() => window.win.openVoiceConversation(sessionId))
									.catch((error: unknown) => {
										setVoiceError(
											error instanceof Error && error.message.trim()
												? error.message
												: 'Voice could not be opened.'
										);
									});
							}}
						>
							<AudioLines className="size-4" strokeWidth={1.8} />
						</Button>
						<DropdownMenuContent
							className="w-64"
							side="right"
							align="end"
						>
							<DropdownMenuLabel className="p-0 font-normal">
								<div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
									<Avatar className="size-8 rounded-md">
										<AvatarImage src={accountItem.avatarPath} alt={accountItem.title} />
										<AvatarFallback className="rounded-md bg-primary text-primary-foreground dark:bg-accent dark:text-accent-foreground">
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
