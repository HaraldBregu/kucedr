import { Bot, FileText, FolderOpen, MapPin } from 'lucide-react';

import { Button } from '@/components/ui/button';
import type { CodingController } from '@/controller';

export function Project({ coding, onOpenConfiguration, onOpenFiles, onOpenInstructions }: { coding: CodingController; onOpenConfiguration: () => void; onOpenFiles: () => void; onOpenInstructions: () => void }) {
	const project = coding.activeProject;
	if (!project) return null;
	return (
		<div className="min-h-0 flex-1 overflow-y-auto bg-background px-4 py-5 sm:px-6">
			<div className="mx-auto max-w-3xl space-y-7">
				<div><p className="text-xs text-muted-foreground">Project</p><h1 className="mt-1 text-xl font-semibold">{project.name}</h1></div>
				<section className="rounded-lg border p-4"><div className="flex items-center gap-2 text-sm font-medium"><MapPin className="size-4 text-muted-foreground" /> Location</div><p className="mt-2 break-all font-mono text-xs text-muted-foreground">{project.directory}</p><Button className="mt-3" variant="outline" size="sm" onClick={() => void coding.openProject(project.id)}><FolderOpen /> Open folder</Button></section>
				<section className="rounded-lg border p-4"><div className="flex items-center gap-2 text-sm font-medium"><Bot className="size-4 text-muted-foreground" /> Coder agent</div><p className="mt-2 text-xs text-muted-foreground">This project uses {coding.modelId || 'the model selected in Coder configuration'} with {coding.toolMode === 'coding' ? 'coding' : 'read-only'} tools.</p><Button className="mt-3" variant="outline" size="sm" onClick={onOpenConfiguration}><Bot /> Configure agent</Button></section>
				<section className="rounded-lg border p-4"><div className="flex items-center gap-2 text-sm font-medium"><FileText className="size-4 text-muted-foreground" /> Project instructions</div><p className="mt-2 text-xs text-muted-foreground">AGENTS.md gives the coding agent project-specific rules and context.</p><div className="mt-3 flex gap-2"><Button variant="outline" size="sm" onClick={onOpenInstructions}><FileText /> Edit AGENTS.md</Button><Button variant="outline" size="sm" onClick={onOpenFiles}>Browse files</Button></div></section>
			</div>
		</div>
	);
}
