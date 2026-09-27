import { RotateCcw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { workspaceSettingsDefaults, type WorkspaceSettings } from '@/lib/settings';

interface WorkspaceSettingsProps {
	onChange: (settings: WorkspaceSettings) => void;
	settings: WorkspaceSettings;
}

export function WorkspaceSettingsView({ onChange, settings }: WorkspaceSettingsProps) {
	return (
		<section className="flex min-h-0 flex-1 flex-col bg-background" aria-label="Workspace settings">
			<header className="flex h-12 shrink-0 items-center border-b px-4">
				<div className="min-w-0 flex-1">
					<h1 className="text-sm font-semibold">Settings</h1>
					<p className="mt-0.5 text-[11px] text-muted-foreground">Workspace editor preferences</p>
				</div>
				<Button
					variant="outline"
					size="sm"
					onClick={() => onChange(workspaceSettingsDefaults)}
				>
					<RotateCcw /> Reset
				</Button>
			</header>
			<div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 scrollbar-subtle sm:px-6">
				<div className="mx-auto max-w-2xl divide-y rounded-md border bg-card">
					<div className="flex items-center gap-4 px-4 py-3">
						<div className="min-w-0 flex-1">
							<label htmlFor="workspace-font-size" className="text-xs font-medium">
								Editor font size
							</label>
							<p className="mt-0.5 text-[11px] text-muted-foreground">Between 10 and 24 pixels.</p>
						</div>
						<Input
							id="workspace-font-size"
							type="number"
							min={10}
							max={24}
							value={settings.fontSize}
							className="h-7 w-20 text-xs"
							onChange={(event) => {
								const fontSize = Math.min(24, Math.max(10, Number(event.target.value) || 10));
								onChange({ ...settings, fontSize });
							}}
						/>
					</div>
					<div className="flex items-center gap-4 px-4 py-3">
						<div className="min-w-0 flex-1">
							<p className="text-xs font-medium">Line numbers</p>
							<p className="mt-0.5 text-[11px] text-muted-foreground">
								Show numbers beside code and structured-data rows.
							</p>
						</div>
						<Button
							variant={settings.lineNumbers ? 'secondary' : 'outline'}
							size="sm"
							aria-pressed={settings.lineNumbers}
							onClick={() => onChange({ ...settings, lineNumbers: !settings.lineNumbers })}
						>
							{settings.lineNumbers ? 'On' : 'Off'}
						</Button>
					</div>
					<div className="flex items-center gap-4 px-4 py-3">
						<div className="min-w-0 flex-1">
							<p className="text-xs font-medium">Word wrap</p>
							<p className="mt-0.5 text-[11px] text-muted-foreground">Wrap long code lines inside the editor.</p>
						</div>
						<Button
							variant={settings.wordWrap ? 'secondary' : 'outline'}
							size="sm"
							aria-pressed={settings.wordWrap}
							onClick={() => onChange({ ...settings, wordWrap: !settings.wordWrap })}
						>
							{settings.wordWrap ? 'On' : 'Off'}
						</Button>
					</div>
				</div>
			</div>
		</section>
	);
}
