import React, { Suspense, lazy, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import {
	Navigate,
	Outlet,
	createHashRouter,
	useLocation,
	useParams,
	type RouteObject,
} from 'react-router-dom';
import { ErrorBoundary, RouteErrorElement } from './components/app/base/ErrorBoundary';
import {
	HomePageLoadingSkeleton,
	PageLoadingSkeleton,
} from './components/app/base/PageLoadingSkeleton';
import { TitleBar } from './components/app/titlebar/TitleBar';
import { Button } from './components/ui/button';
import { Layout as SettingsLayout, SettingsBreadcrumb } from './pages/settings';
import { SettingsPageSkeleton } from './pages/settings/components';
import { SETTINGS_MODEL_SERVICE_ITEMS } from './pages/settings/navigation';
import { CommandMenu, PageTransition } from './experience';
import { ChatModeContext, type ChatMode } from './contexts/chat-mode';
import {
	ChatSessionContext,
	persistChatSessionId,
	readPersistedChatSessionId,
} from './contexts/chat-session';
import { cn } from './lib/utils';
import HomePage from './pages/home/Page';
import StartPage from './pages/start/StartPage';
import { usePageContext } from './components/app/base/page';
import { StartupGate } from './auth/Gate';
import { useOnboarding } from './contexts/useOnboarding';
import { useAuth } from './contexts/AuthContext';

const AccountPage = lazy(() => import('./pages/settings/pages/account/Page'));
const CloudPage = lazy(() => import('./pages/settings/pages/cloud/Page'));
const TasksPage = lazy(() => import('./pages/settings/pages/tasks/Page'));
const TaskDetailsPage = lazy(() => import('./pages/settings/pages/tasks/detail/Page'));
const GeneralPage = lazy(() => import('./pages/settings/pages/general/Page'));
const PersonaPage = lazy(() => import('./pages/settings/pages/general/persona/Page'));
const SystemPage = lazy(() => import('./pages/settings/pages/system/Page'));
const SystemMediaDetailPage = lazy(() => import('./pages/settings/pages/system/detail/Page'));
const ChannelsPage = lazy(() => import('./pages/settings/pages/channels/Page'));
const ChannelDetailPage = lazy(() => import('./pages/settings/pages/channels/detail/Page'));
const SkillsPage = lazy(() => import('./pages/settings/pages/skills/Page'));
const SkillDetailsPage = lazy(() => import('./pages/settings/pages/skills/details/Page'));
const ProvidersPage = lazy(() => import('./pages/settings/pages/providers/Page'));
const StorageProvidersPage = lazy(() => import('./pages/settings/pages/providers/storage/Page'));
const McpPage = lazy(() => import('./pages/settings/pages/mcp/Page'));
const A2aPage = lazy(() => import('./pages/settings/pages/a2a/Page'));
const McpDetailsPage = lazy(() => import('./pages/settings/pages/mcp/details/Page'));
const RagPage = lazy(() => import('./pages/settings/pages/rag/Page'));
const PermissionsPage = lazy(() => import('./pages/settings/pages/permissions/Page'));
const HealthPage = lazy(() => import('./pages/settings/pages/tasks/health/Page'));
const AssistantPage = lazy(() => import('./pages/settings/pages/assistant/Page'));
const ToolsPage = lazy(() => import('./pages/settings/pages/assistant/tools/Page'));
const CodingPage = lazy(() => import('./pages/settings/pages/coding/Page'));
const ChatHistoryPage = lazy(() => import('./pages/settings/pages/assistant/chathistory/Page'));
const AppsPage = lazy(() => import('./pages/settings/pages/apps/Page'));
const AppDetailsPage = lazy(() => import('./pages/settings/pages/apps/details/Page'));
const SIDEBAR_TRANSITION_MS = 200;

function ModelServiceLegacyRedirect(): React.JSX.Element {
	const location = useLocation();
	const { serviceId } = useParams();
	const decoded = decodeURIComponent(serviceId ?? '');
	const normalized = decoded === 'kucedr' || decoded === 'main' ? 'assistant' : decoded;
	const item = SETTINGS_MODEL_SERVICE_ITEMS.find((entry) => entry.id === normalized);
	if (!item) return <Navigate to="/settings/general" replace />;
	const isChatHistory = location.pathname.endsWith('/chathistory');
	return <Navigate to={isChatHistory ? `${item.path}/chathistory` : item.path} replace />;
}

function AppDetailsLegacyRedirect(): React.JSX.Element {
	const { appId } = useParams();
	return <Navigate to={`/settings/apps/${appId ?? ''}`} replace />;
}

function RouteWrapper({
	children,
	fallback = <PageLoadingSkeleton />,
}: {
	readonly children: ReactNode;
	readonly fallback?: ReactNode;
}): React.JSX.Element {
	return (
		<ErrorBoundary level="route">
			<Suspense fallback={fallback}>{children}</Suspense>
		</ErrorBoundary>
	);
}

function SettingsRouteWrapper({ children }: { readonly children: ReactNode }): React.JSX.Element {
	return (
		<ErrorBoundary level="route">
			<Suspense fallback={<SettingsPageSkeleton />}>{children}</Suspense>
		</ErrorBoundary>
	);
}

function RootRouteComponent(): React.JSX.Element {
	const location = useLocation();
	const { state, isMobile } = usePageContext();
	const [chatMode, setChatMode] = useState<ChatMode>('chat');
	const [chatSessionId, setChatSessionId] = useState<string>(readPersistedChatSessionId);
	const [commandMenuOpen, setCommandMenuOpen] = useState(false);
	const [showSettingsBreadcrumb, setShowSettingsBreadcrumb] = useState(true);
	const previousSidebarOpen = useRef(state.sidebarOpen);

	const { phase } = useOnboarding();
	const { state: authState, skipSignIn } = useAuth();
	const showOnboardingTitle = phase === 'auth' || phase === 'setup';
	const isHome = location.pathname === '/home';
	const isSettings = location.pathname.startsWith('/settings');
	const hasSidebar = isHome || isSettings;

	useLayoutEffect(() => {
		const sidebarChanged = previousSidebarOpen.current !== state.sidebarOpen;
		previousSidebarOpen.current = state.sidebarOpen;

		if (!isSettings || isMobile || !sidebarChanged) {
			setShowSettingsBreadcrumb(true);
			return;
		}

		setShowSettingsBreadcrumb(false);
		const timeout = window.setTimeout(() => setShowSettingsBreadcrumb(true), SIDEBAR_TRANSITION_MS);
		return () => window.clearTimeout(timeout);
	}, [isMobile, isSettings, state.sidebarOpen]);

	return (
		<ChatModeContext.Provider value={{ mode: chatMode, setMode: setChatMode }}>
			<ChatSessionContext.Provider
				value={{
					sessionId: chatSessionId,
					setSessionId: (sessionId) => {
						setChatSessionId(sessionId);
						persistChatSessionId(sessionId);
					},
				}}
			>
				<div
					className={cn(
						'app-translucent-window flex h-screen flex-col overflow-hidden bg-background text-foreground'
					)}
				>
					<TitleBar
						centerContent={
							showOnboardingTitle ? (
								<span className="text-sm font-medium">Kucedr</span>
							) : isSettings && showSettingsBreadcrumb ? (
								<SettingsBreadcrumb />
							) : undefined
						}
						centerContentClassName={
							showOnboardingTitle
								? 'left-1/2 right-auto -translate-x-1/2'
								: isSettings && (isMobile || !state.sidebarOpen)
									? 'left-28'
									: undefined
						}
						rightContent={
							phase === 'auth' && authState.status !== 'recovery' ? (
								<Button type="button" variant="ghost" size="sm" onClick={skipSignIn}>
									Skip
								</Button>
							) : undefined
						}
						onSearch={hasSidebar ? () => setCommandMenuOpen(true) : undefined}
						style={
							hasSidebar
								? { left: !isMobile && state.sidebarOpen ? 'var(--app-sidebar-width)' : 0 }
								: undefined
						}
					/>
					<div className="min-h-0 flex-1 overflow-hidden pt-12">
						<PageTransition>
							<Outlet />
						</PageTransition>
					</div>
					<CommandMenu
						key={location.pathname}
						open={commandMenuOpen}
						onOpenChange={setCommandMenuOpen}
					/>
				</div>
			</ChatSessionContext.Provider>
		</ChatModeContext.Provider>
	);
}

const routes: RouteObject[] = [
	{
		element: (
			<StartupGate>
				<RootRouteComponent />
			</StartupGate>
		),
		errorElement: (
			<div className="app-translucent-window flex h-screen flex-col text-foreground">
				<RouteErrorElement />
			</div>
		),
		children: [
			{
				path: 'auth',
				element: <Navigate to="/start" replace />,
			},
			{
				index: true,
				element: <Navigate to="/start" replace />,
			},
			{
				path: 'start',
				element: <StartPage />,
			},
			{
				path: 'setup',
				element: <Navigate to="/start" replace />,
			},
			{
				path: 'config',
				element: <Navigate to="/start" replace />,
			},
			{
				path: 'home',
				element: (
					<RouteWrapper fallback={<HomePageLoadingSkeleton />}>
						<HomePage />
					</RouteWrapper>
				),
			},
			{
				path: 'settings',
				element: (
					<RouteWrapper>
						<SettingsLayout />
					</RouteWrapper>
				),
				children: [
					{
						index: true,
						element: <Navigate to="/settings/general" replace />,
					},
					{
						path: 'account',
						element: (
							<SettingsRouteWrapper>
								<AccountPage />
							</SettingsRouteWrapper>
						),
					},
					{
						path: 'cloud',
						element: (
							<SettingsRouteWrapper>
								<CloudPage />
							</SettingsRouteWrapper>
						),
					},
					{
						path: 'general',
						children: [
							{
								index: true,
								element: (
									<SettingsRouteWrapper>
										<GeneralPage />
									</SettingsRouteWrapper>
								),
							},
							{
								path: 'persona',
								element: (
									<SettingsRouteWrapper>
										<PersonaPage />
									</SettingsRouteWrapper>
								),
							},
						],
					},
					{
						path: 'system',
						children: [
							{
								index: true,
								element: (
									<SettingsRouteWrapper>
										<SystemPage />
									</SettingsRouteWrapper>
								),
							},
							{
								path: 'media/:mediaId',
								element: (
									<SettingsRouteWrapper>
										<SystemMediaDetailPage />
									</SettingsRouteWrapper>
								),
							},
						],
					},
					{
						path: 'channels',
						children: [
							{
								index: true,
								element: (
									<SettingsRouteWrapper>
										<ChannelsPage />
									</SettingsRouteWrapper>
								),
							},
							{
								path: 'channelDetail/telegram',
								element: (
									<SettingsRouteWrapper>
										<ChannelDetailPage />
									</SettingsRouteWrapper>
								),
							},
						],
					},
					{
						path: 'a2a',
						element: (
							<SettingsRouteWrapper>
								<A2aPage />
							</SettingsRouteWrapper>
						),
					},
					{
						path: 'providers',
						children: [
							{
								index: true,
								element: <Navigate to="/settings/providers/models" replace />,
							},
							{
								path: 'models',
								element: (
									<SettingsRouteWrapper>
										<ProvidersPage section="models" />
									</SettingsRouteWrapper>
								),
							},
							{
								path: 'database',
								element: (
									<SettingsRouteWrapper>
										<ProvidersPage section="databases" />
									</SettingsRouteWrapper>
								),
							},
							{
								path: 'databases',
								element: <Navigate to="/settings/providers/database" replace />,
							},
							{
								path: 'storage',
								element: (
									<SettingsRouteWrapper>
										<StorageProvidersPage />
									</SettingsRouteWrapper>
								),
							},
							{
								path: 'search',
								element: (
									<SettingsRouteWrapper>
										<ProvidersPage section="search" />
									</SettingsRouteWrapper>
								),
							},
							{
								path: 'transcribe',
								element: <Navigate to="/settings/agent" replace />,
							},
						],
					},
					{
						path: 'knowledge-base',
						element: <Navigate to="/settings/agent/rag" replace />,
					},
					{
						path: 'coding',
						element: (
							<SettingsRouteWrapper>
								<CodingPage />
							</SettingsRouteWrapper>
						),
					},
					{
						path: 'agent',
						children: [
							{
								path: 'tools',
								element: (
									<SettingsRouteWrapper>
										<ToolsPage />
									</SettingsRouteWrapper>
								),
							},
							{
								path: 'skills',
								children: [
									{
										index: true,
										element: (
											<SettingsRouteWrapper>
												<SkillsPage />
											</SettingsRouteWrapper>
										),
									},
									{
										path: 'skilldetails/:skillId',
										element: (
											<SettingsRouteWrapper>
												<SkillDetailsPage />
											</SettingsRouteWrapper>
										),
									},
								],
							},
							{
								path: 'tasks',
								children: [
									{
										index: true,
										element: (
											<SettingsRouteWrapper>
												<TasksPage />
											</SettingsRouteWrapper>
										),
									},
									{
										path: ':taskId/detail',
										element: (
											<SettingsRouteWrapper>
												<TaskDetailsPage />
											</SettingsRouteWrapper>
										),
									},
								],
							},
							{
								path: 'mcp',
								children: [
									{
										index: true,
										element: (
											<SettingsRouteWrapper>
												<McpPage />
											</SettingsRouteWrapper>
										),
									},
									{
										path: ':mcpServerId',
										element: (
											<SettingsRouteWrapper>
												<McpDetailsPage />
											</SettingsRouteWrapper>
										),
									},
								],
							},
							{
								index: true,
								element: (
									<SettingsRouteWrapper>
										<AssistantPage />
									</SettingsRouteWrapper>
								),
							},
							{
								path: 'chathistory',
								element: (
									<SettingsRouteWrapper>
										<ChatHistoryPage />
									</SettingsRouteWrapper>
								),
							},
							{
								path: 'rag',
								element: (
									<SettingsRouteWrapper>
										<RagPage />
									</SettingsRouteWrapper>
								),
							},
							{
								path: 'knowledge-base',
								element: <Navigate to="/settings/agent/rag" replace />,
							},
							{
								path: 'health',
								element: (
									<SettingsRouteWrapper>
										<HealthPage />
									</SettingsRouteWrapper>
								),
							},
							{
								path: 'permissions',
								element: (
									<SettingsRouteWrapper>
										<PermissionsPage />
									</SettingsRouteWrapper>
								),
							},
							{
								path: 'policies',
								element: <Navigate to="/settings/agent/permissions" replace />,
							},
						],
					},
					{
						path: 'transcribe',
						element: <Navigate to="/settings/agent" replace />,
					},
					{
						path: 'speech-to-text',
						element: <Navigate to="/settings/agent" replace />,
					},
					{
						path: 'apps',
						children: [
							{
								index: true,
								element: (
									<SettingsRouteWrapper>
										<AppsPage />
									</SettingsRouteWrapper>
								),
							},
							{
								path: ':appId',
								element: (
									<SettingsRouteWrapper>
										<AppDetailsPage />
									</SettingsRouteWrapper>
								),
							},
							{
								path: 'appdetails/:appId',
								element: <AppDetailsLegacyRedirect />,
							},
						],
					},
					{
						path: 'model-services/:serviceId/details/*',
						element: <ModelServiceLegacyRedirect />,
					},
					{
						path: '*',
						loader: () => {
							throw new Response('Not Found', { status: 404, statusText: 'Not Found' });
						},
					},
				],
			},
			{
				path: '*',
				loader: () => {
					throw new Response('Not Found', { status: 404, statusText: 'Not Found' });
				},
			},
		],
	},
];

export const router = createHashRouter(routes);
