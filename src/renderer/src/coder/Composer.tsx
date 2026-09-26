import { Bot, CornerDownLeft, Square, TerminalSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Choice } from './Choice';
import type { CodingSettings } from '@shared/coding_types';
import type { Workspace } from './workspace';

export function Composer({
	coding,
	onConfiguration,
}: {
	coding: Workspace;
	onConfiguration: () => void;
}) {
	const project = coding.projects.find((item) => item.id === coding.projectId);
	const disabled =
		(!project?.available && !coding.settings?.workingDirectory) ||
		coding.loading ||
		coding.busy ||
		(coding.mode === 'agent' && !coding.settings?.modelId);
	return (
		<form
			className="mx-auto w-full max-w-3xl shrink-0 p-3"
			onSubmit={(event) => {
				event.preventDefault();
				void coding.send();
			}}
		>
			<div className="mb-2 flex flex-wrap items-center gap-2">
				<Choice
					value={coding.settings?.runtime ?? 'pi'}
					options={[
						{ value: 'pi', label: 'Pi' },
						{ value: 'codex', label: 'Codex' },
						{ value: 'cline', label: 'Cline' },
					]}
					disabled={coding.busy || coding.loading || Boolean(coding.snapshot)}
					onChange={(value) => void coding.changeHarness(value as CodingSettings['runtime'])}
				/>
				<Button
					type="button"
					variant="ghost"
					size="sm"
					className="min-w-0 max-w-64 truncate"
					title={
						coding.snapshot?.session.workingDirectory ??
						project?.directory ??
						coding.settings?.workingDirectory
					}
					disabled={coding.busy || coding.loading || Boolean(coding.snapshot)}
					onClick={() => void coding.addProject()}
				>
					{project?.name ?? coding.settings?.workingDirectory ?? 'Choose folder'}
				</Button>
			</div>
			<div className="rounded-lg border bg-card focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/20">
				<Textarea
					id="coder-composer"
					aria-label={coding.mode === 'agent' ? 'Agent prompt' : 'Shell command'}
					placeholder={
						coding.mode === 'agent'
							? 'Ask Coder to build, debug, or explain…'
							: 'Run one command in this project…'
					}
					disabled={disabled}
					value={coding.input}
					onChange={(event) => coding.setInput(event.target.value)}
					className="max-h-48 min-h-20 resize-none border-0 bg-transparent shadow-none focus-visible:ring-0 dark:bg-transparent"
					onKeyDown={(event) => {
						if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
							event.preventDefault();
							void coding.send();
						}
					}}
				/>
				<div className="flex flex-wrap items-center gap-2 px-2 pb-2">
					<div className="flex rounded-md bg-muted/70 p-0.5" aria-label="Input mode">
						<Button
							type="button"
							size="sm"
							className="h-7 px-2"
							variant={coding.mode === 'agent' ? 'secondary' : 'ghost'}
							aria-pressed={coding.mode === 'agent'}
							disabled={coding.busy}
							onClick={() => coding.setMode('agent')}
						>
							<Bot className="size-3.5" />
							Agent
						</Button>
						<Button
							type="button"
							size="sm"
							className="h-7 px-2"
							variant={coding.mode === 'shell' ? 'secondary' : 'ghost'}
							aria-pressed={coding.mode === 'shell'}
							disabled={coding.busy}
							onClick={() => coding.setMode('shell')}
							title="Runs one recorded, non-interactive command"
						>
							<TerminalSquare className="size-3.5" />
							Command
						</Button>
					</div>
					<Button
						type="button"
						variant="ghost"
						size="sm"
						disabled={coding.busy}
						onClick={onConfiguration}
						className="h-7 max-w-40 truncate px-2 text-xs text-muted-foreground"
						title="Open Coder configuration"
					>
						{coding.settings?.modelId || 'Choose model'}
					</Button>
					{coding.busy ? (
						<Button
							type="button"
							className="ml-auto"
							size="icon-sm"
							variant="destructive"
							aria-label="Stop current run"
							onClick={() => void coding.cancel()}
						>
							<Square className="size-4" />
						</Button>
					) : (
						<Button
							type="submit"
							size="sm"
							className="ml-auto"
							disabled={disabled || !coding.input.trim()}
						>
							{coding.mode === 'agent' ? 'Send' : 'Run'}
							<CornerDownLeft className="size-4" />
						</Button>
					)}
				</div>
			</div>
		</form>
	);
}
