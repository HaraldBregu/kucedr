import { Bot, CircleStop, CornerDownLeft, TerminalSquare } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { CodingController } from '@/controller';

export function Composer({ coder }: { coder: CodingController }) {
	const disabled = !coder.activeProject?.available || !coder.modelId;
	return (
		<form
			className="shrink-0 bg-background px-3 pb-3 pt-1"
			onSubmit={(event) => {
				event.preventDefault();
				void coder.send();
			}}
		>
			<div className="mx-auto max-w-4xl rounded-lg border bg-card focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/20">
				<Textarea
					id="coding-composer"
					value={coder.input}
					onChange={(event) => coder.setInput(event.target.value)}
					onKeyDown={(event) => {
						if (event.ctrlKey && event.key.toLowerCase() === 'c' && coder.runState === 'running') {
							event.preventDefault();
							coder.cancelRun();
							return;
						}
						if (event.key === 'Enter' && !event.shiftKey) {
							event.preventDefault();
							void coder.send();
						}
					}}
					placeholder={
						disabled
							? 'Open an available project and configure a model…'
							: coder.mode === 'agent'
								? 'Ask Pi to build, debug, or explain…'
								: 'Run one command in this project…'
					}
					disabled={disabled}
					aria-label={coder.mode === 'agent' ? 'Agent prompt' : 'Shell command'}
					className="min-h-16 max-h-48 border-0 bg-transparent font-sans shadow-none focus-visible:border-0 focus-visible:ring-0"
				/>
				<div className="flex items-center gap-2 px-2 pb-2">
					<div className="flex items-center rounded-md bg-muted/70 p-0.5" aria-label="Input mode">
						<Button
							type="button"
							size="sm"
							variant={coder.mode === 'agent' ? 'secondary' : 'ghost'}
							className="h-7 gap-1.5 px-2"
							aria-pressed={coder.mode === 'agent'}
							onClick={() => coder.setMode('agent')}
						>
							<Bot /> Agent
						</Button>
						<Tooltip>
							<TooltipTrigger
								render={
									<Button
										type="button"
										size="sm"
										variant={coder.mode === 'shell' ? 'secondary' : 'ghost'}
										className="h-7 gap-1.5 px-2"
										aria-pressed={coder.mode === 'shell'}
										onClick={() => coder.setMode('shell')}
									>
										<TerminalSquare /> Command
									</Button>
								}
							/>
							<TooltipContent>Runs one recorded, non-interactive command</TooltipContent>
						</Tooltip>
					</div>
					<span className="ml-auto" />
					{coder.runState === 'running' ? (
						<Tooltip>
							<TooltipTrigger
								render={
									<Button
										type="button"
										size="icon-sm"
										variant="destructive"
										onClick={coder.cancelRun}
									>
										<CircleStop />
										<span className="sr-only">Stop current run</span>
									</Button>
								}
							/>
							<TooltipContent>Stop · Ctrl+C</TooltipContent>
						</Tooltip>
					) : (
						<Button
							type="submit"
							size="sm"
							disabled={disabled || !coder.input.trim()}
							className="min-w-16 gap-1.5"
						>
							{coder.mode === 'agent' ? 'Send' : 'Run'} <CornerDownLeft />
						</Button>
					)}
				</div>
			</div>
		</form>
	);
}
