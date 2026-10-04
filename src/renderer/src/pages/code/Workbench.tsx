import { useState } from 'react';
import { ArrowUp, PanelRight, Square } from 'lucide-react';
import { Group, Panel, Separator } from 'react-resizable-panels';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { PromptEditor } from '@/components/prompt-editor';
import { useIsMobile } from '@/hooks/use-mobile';
import { CodeFileViewer } from './Viewer';
import { CodeSessions } from './Sessions';
import { useSessions } from './useSessions';

export function CodeWorkbench({ projectId, fileName }: { readonly projectId: string; readonly fileName: string }): React.JSX.Element {
	const { t } = useTranslation();
	const mobile = useIsMobile();
	const [open, setOpen] = useState(false);
	const [content, setContent] = useState<string | null>(null);
	const [prompts, setPrompts] = useState<Record<string, string>>({});
	const sessions = useSessions(projectId);
	const prompt = prompts[fileName] ?? '';
	const canRun = Boolean(prompt.trim()) && content !== null && !sessions.running;
	const run = (): void => {
		if (!canRun || content === null) return;
		setOpen(true);
		void sessions.run(prompt, fileName, content).then((success) => {
			if (success) setPrompts((current) => current[fileName] === prompt ? { ...current, [fileName]: '' } : current);
		});
	};
	return (
		<Group orientation={mobile ? 'vertical' : 'horizontal'} className="h-full min-h-0 min-w-0 flex-1">
			<Panel id="file" minSize="30%" className="min-w-0">
				<CodeFileViewer key={fileName} projectId={projectId} fileName={fileName} onContentChange={setContent} actions={
					<Button variant="ghost" size="icon-sm" aria-label={t('codeSessions.toggle', 'Toggle sessions')} aria-expanded={open} aria-controls="coder-sessions" onClick={() => setOpen(!open)}><PanelRight /></Button>
				} footer={
					<footer className="shrink-0 border-t p-3">
						<PromptEditor value={prompt} onValueChange={(value) => setPrompts((current) => ({ ...current, [fileName]: value }))} onSubmit={run} expanded={false} detachedControls disabled={sessions.running} ariaLabel={t('codeSessions.prompt', 'File prompt')} placeholder={t('codeSessions.placeholder', 'Ask about this file…')} footerContent={<span className="min-w-0 truncate text-xs text-muted-foreground">{fileName}</span>} trailingAction={sessions.running ? <Button size="icon-sm" variant="secondary" aria-label={t('codeSessions.stop', 'Stop run')} onClick={() => void sessions.cancel()}><Square className="size-3" /></Button> : <Button size="icon-sm" aria-label={t('codeSessions.run', 'Run')} disabled={!canRun} onClick={run}><ArrowUp /></Button>} />
					</footer>
				} />
			</Panel>
			{open && <>
				<Separator aria-label={t('codeSessions.resize', 'Resize sessions')} className={mobile ? 'h-1 bg-border outline-none focus-visible:bg-ring' : 'w-1 bg-border outline-none focus-visible:bg-ring'} />
				<Panel id="sessions" defaultSize="35%" minSize="25%" maxSize="70%" className="min-h-0 min-w-0">
					<CodeSessions sessions={sessions} canRun={canRun} onRun={run} onClose={() => setOpen(false)} />
				</Panel>
			</>}
		</Group>
	);
}
