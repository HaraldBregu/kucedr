import { useEffect, useState, type ReactElement } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowUpRight, MessageCircle } from 'lucide-react';
import { ProviderAvatar } from '@/components/provider-avatar';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useChatSession } from '@/contexts/chat-session';
import type { AgentSessionSummary } from '@/lib/compat';
import { mcps } from '@/lib/providers';
import { SETTINGS_NAVIGATION } from '@/pages/settings/navigation';

const setupPaths = [
	'/settings/tasks',
	'/settings/memory',
	'/settings/knowledge-base',
	'/settings/skills',
	'/settings/mcp',
] as const;

const setupItems = setupPaths.flatMap((path) =>
	SETTINGS_NAVIGATION.filter((item) => item.path === path)
);

export function Discover(): ReactElement {
	const { t } = useTranslation();
	const { setSessionId, setSessionTitle } = useChatSession();
	const [sessions, setSessions] = useState<AgentSessionSummary[]>([]);
	const [refreshKey, setRefreshKey] = useState(0);
	const plugins = mcps().slice(0, 8);

	useEffect(() => {
		let active = true;
		void window.agent.listSessions().then(
			(items) => {
				if (!active) return;
				setSessions([...items].sort((a, b) => (b.updatedAtMs ?? b.createdAtMs) - (a.updatedAtMs ?? a.createdAtMs)).slice(0, 8));
			},
			() => {
				if (active) setSessions([]);
			}
		);
		return () => {
			active = false;
		};
	}, [refreshKey]);

	return (
		<div className="flex w-full flex-col gap-6" data-slot="home-discover">
			{sessions.length > 0 && (
				<section aria-labelledby="home-recent-chats">
					<div className="mb-3 flex items-center justify-between gap-3">
						<h2 id="home-recent-chats" className="text-sm font-medium">
							Recent chats
						</h2>
						<Button variant="ghost" size="sm" onClick={() => setRefreshKey((value) => value + 1)}>
							Refresh
						</Button>
					</div>
					<div className="flex snap-x gap-3 overflow-x-auto pb-2" aria-label="Recent chats">
						{sessions.map((session) => (
							<Card key={session.id} className="w-64 shrink-0 snap-start gap-0 rounded-lg py-0">
								<button
									type="button"
									className="flex h-20 w-full flex-col justify-between gap-1 px-3 py-2 text-left outline-none hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring"
									onClick={() => {
										setSessionId(session.id);
										setSessionTitle?.(session.title, session.id);
									}}
								>
									<span className="flex w-full items-center justify-between gap-2 text-[11px] text-muted-foreground">
										<MessageCircle className="size-4 shrink-0" aria-hidden="true" />
										<time
											dateTime={new Date(session.updatedAtMs ?? session.createdAtMs).toISOString()}
											className="truncate"
										>
											Updated{' '}
											{new Date(session.updatedAtMs ?? session.createdAtMs).toLocaleString(undefined, {
												month: 'short',
												day: 'numeric',
												hour: 'numeric',
												minute: '2-digit',
											})}
										</time>
									</span>
									<span className="line-clamp-2 text-sm font-medium">
										{session.title.trim() || t('settings.chatHistory.untitled')}
									</span>
								</button>
							</Card>
						))}
					</div>
				</section>
			)}
			<section aria-labelledby="home-plugins">
				<div className="mb-3 flex items-center justify-between gap-3">
					<h2 id="home-plugins" className="text-sm font-medium">
						Plugins
					</h2>
					<Link
						to="/settings/plugins"
						className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
					>
						View all <ArrowUpRight className="size-3.5" aria-hidden="true" />
					</Link>
				</div>
				<div className="flex snap-x gap-3 overflow-x-auto pb-2" aria-label="Plugins">
					{plugins.map((plugin) => (
						<Card
							key={`${plugin.provider.id}/${plugin.id}`}
							className="w-64 shrink-0 snap-start gap-0 rounded-lg py-0"
						>
							<Link
								to={`/settings/plugins/mcp/${plugin.provider.id}/${plugin.id}`}
								className="flex h-24 flex-col gap-1 px-4 py-2 outline-none hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring"
							>
								<div className="flex min-w-0 items-center gap-2">
									<ProviderAvatar
										providerId={plugin.id}
										name={plugin.name}
										iconDarkUrl={plugin.iconDarkUrl}
										iconLightUrl={plugin.iconLightUrl}
										className="size-10 shrink-0 rounded-md"
									/>
									<span className="truncate text-sm font-medium">{plugin.name}</span>
								</div>
								<p className="line-clamp-2 text-xs text-muted-foreground">{plugin.description}</p>
							</Link>
						</Card>
					))}
					{plugins.length === 0 && (
						<Card className="w-64 shrink-0 rounded-lg px-4 py-4 text-sm text-muted-foreground">
							No plugins available.
						</Card>
					)}
				</div>
			</section>
			<section aria-labelledby="home-configure">
				<h2 id="home-configure" className="mb-3 text-sm font-medium">
					Configure Kucedr
				</h2>
				<div className="flex snap-x gap-3 overflow-x-auto pb-2" aria-label="Configure Kucedr">
					{setupItems.map((item) => (
						<Card key={item.path} className="w-64 shrink-0 snap-start gap-0 rounded-lg py-0">
							<Link
								to={item.path}
								className="flex h-24 flex-col gap-1 px-4 py-2 outline-none hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring"
							>
								<div className="flex items-center gap-2">
									<item.icon className="size-4 text-muted-foreground" aria-hidden="true" />
									<span className="text-sm font-medium">{t(item.labelKey)}</span>
								</div>
								<p className="line-clamp-2 text-xs text-muted-foreground">
									{t(item.descriptionKey)}
								</p>
							</Link>
						</Card>
					))}
				</div>
			</section>
		</div>
	);
}
