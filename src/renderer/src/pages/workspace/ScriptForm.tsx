import { useEffect, useState } from 'react';
import { PluginScriptFrame } from '@/components/plugin-script/Frame';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { PluginScriptInfo } from '../../../../shared/plugin_types';
import { ScriptProperties } from './Properties';

interface WorkspaceScriptFormProps {
	readonly script: PluginScriptInfo;
	readonly value: Record<string, unknown>;
	readonly submitLabel: string;
	readonly onClose: () => void;
	readonly onSubmit: (value: Record<string, unknown>) => void;
}

/** Edits a script's properties with a live preview of the script. */
export function WorkspaceScriptForm({ script, value, submitLabel, onClose, onSubmit }: WorkspaceScriptFormProps): React.JSX.Element {
	const [draft, setDraft] = useState(value);
	const [preview, setPreview] = useState(value);
	useEffect(() => {
		// ponytail: fixed 400ms debounce so each keystroke doesn't spawn a script render
		const timer = setTimeout(() => setPreview(draft), 400);
		return () => clearTimeout(timer);
	}, [draft]);

	return (
		<Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
			<DialogContent showCloseButton={false} className="sm:max-w-4xl">
				<form className="grid gap-4" onSubmit={(event) => {
					event.preventDefault();
					onSubmit(draft);
				}}>
					<DialogHeader>
						<DialogTitle>{script.title}</DialogTitle>
						<DialogDescription>{script.plugin.name}</DialogDescription>
					</DialogHeader>
					<div className="grid max-h-[65vh] gap-4 overflow-y-auto md:grid-cols-[18rem_minmax(0,1fr)]">
						{script.inputSchema ? <ScriptProperties schema={script.inputSchema} value={draft} onChange={setDraft} /> : null}
						<div className="min-w-0 rounded-md border p-2">
							<PluginScriptFrame script={script} input={preview} />
						</div>
					</div>
					<DialogFooter>
						<DialogClose render={<Button type="button" variant="outline">Cancel</Button>} />
						<Button type="submit">{submitLabel}</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
