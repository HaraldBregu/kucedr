import { PanelRightClose, Play, Plus, Square } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { SessionInteraction } from './Interaction';
import type { useSessions } from './useSessions';

export function CodeSessions({ sessions, canRun, onRun, onClose }: { readonly sessions: ReturnType<typeof useSessions>; readonly canRun: boolean; readonly onRun: () => void; readonly onClose: () => void }): React.JSX.Element {
	const { t } = useTranslation();
	return (
		<aside id="coder-sessions" aria-label={t('codeSessions.title', 'Harness sessions')} className="flex h-full min-h-0 flex-col bg-background">
			<header className="flex h-10 shrink-0 items-center gap-1 border-b px-2">
				<h2 className="min-w-0 flex-1 truncate text-xs font-medium">{t('codeSessions.title', 'Harness sessions')}</h2>
				{sessions.running ? <Button size="xs" variant="secondary" onClick={() => void sessions.cancel()}><Square />{t('codeSessions.stop', 'Stop run')}</Button> : <Button size="xs" disabled={!canRun} onClick={onRun}><Play />{t('codeSessions.run', 'Run')}</Button>}
				<Button size="icon-sm" variant="ghost" aria-label={t('codeSessions.close', 'Close sessions')} onClick={onClose}><PanelRightClose /></Button>
			</header>
			<div className="max-h-[40%] shrink-0 overflow-y-auto border-b p-2">
				<Button size="sm" variant={sessions.selectedSessionId === null ? 'secondary' : 'ghost'} className="mb-1 w-full justify-start" disabled={sessions.running} onClick={() => sessions.selectSession(null)}><Plus />{t('codeSessions.new', 'New session')}</Button>
				{sessions.loading && <p className="p-2 text-xs text-muted-foreground">{t('codeSessions.loading', 'Loading sessions…')}</p>}
				{!sessions.loading && sessions.sessions.length === 0 && <p className="p-2 text-xs text-muted-foreground">{t('codeSessions.empty', 'No sessions yet.')}</p>}
				{sessions.sessions.map((session) => <button key={session.id} type="button" disabled={sessions.running} aria-pressed={sessions.selectedSessionId === session.id} onClick={() => sessions.selectSession(session.id)} className={cn('flex w-full min-w-0 items-center gap-2 rounded-md px-2 py-2 text-left text-xs hover:bg-accent disabled:opacity-50', sessions.selectedSessionId === session.id && 'bg-accent')}><span className="min-w-0 flex-1 truncate" title={session.title}>{session.title}</span><span className="shrink-0 text-[10px] uppercase text-muted-foreground">{session.runtime ?? 'pi'}</span></button>)}
			</div>
			<div aria-label={t('codeSessions.output', 'Session output')} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3 text-xs">
				{sessions.error && <p role="alert" className="text-destructive">{sessions.error}</p>}
				{sessions.snapshot?.blocks.map((block) => <div key={block.id} className="min-w-0 whitespace-pre-wrap break-words leading-relaxed">
					{block.type === 'message' ? <><p className="mb-1 font-medium capitalize text-muted-foreground">{block.role}</p>{block.content}</> : block.type === 'command' ? <><p className="font-mono">{block.command}</p><pre className="whitespace-pre-wrap break-words">{block.output}</pre></> : <p className="text-muted-foreground">{block.toolName} · {block.status}</p>}
				</div>)}
				{sessions.running && <p className="text-muted-foreground">{t('codeSessions.running', 'Running…')}</p>}
				{sessions.output && <div className="whitespace-pre-wrap break-words leading-relaxed">{sessions.output}</div>}
				{sessions.interactions.map((interaction) => <SessionInteraction key={interaction.requestId} interaction={interaction} onRespond={(response) => sessions.respond(interaction.requestId, response)} />)}
			</div>
		</aside>
	);
}
