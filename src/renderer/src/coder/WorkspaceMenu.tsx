import type { CSSProperties } from 'react';
import {
	Check,
	ChevronDown,
	FileText,
	Folder,
	FolderOpen,
	FolderPlus,
	Settings,
	Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { Workspace } from './workspace';

export function WorkspaceMenu({
	coding,
	onSelect,
	onInstructions,
	onBeforeChange,
	onConfiguration,
	settingsActive,
}: {
	coding: Workspace;
	onBeforeChange: () => boolean;
	onSelect: (projectId: string) => void;
	onInstructions: (projectId: string) => void;
	onConfiguration: () => void;
	settingsActive: boolean;
}) {
	const project = coding.projects.find((item) => item.id === coding.projectId);
	return (
		<div className="min-w-0 shrink-0" style={{ WebkitAppRegion: 'no-drag' } as CSSProperties}>
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button
						variant="ghost"
						size="sm"
						aria-label="Select workspace"
						aria-current={settingsActive ? 'page' : undefined}
						title={project?.directory ?? 'Choose workspace'}
						className="max-w-56 min-w-0 shrink-0 gap-1.5 px-2 text-sm"
					>
						<Folder className="size-4 shrink-0" />
						<span className="truncate">{project?.name ?? 'Choose workspace'}</span>
						<ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent className="w-72 max-w-[90vw]" side="bottom" align="start">
					<DropdownMenuLabel className="min-w-0">
						<div className="truncate text-sm">{project?.name ?? 'Choose workspace'}</div>
						<div className="truncate text-xs font-normal text-muted-foreground">
							{project?.directory ?? 'Open a folder to start coding'}
						</div>
					</DropdownMenuLabel>
					<DropdownMenuSeparator />
					{coding.projects.map((item) => (
						<DropdownMenuItem
							key={item.id}
							disabled={coding.busy || !item.available}
							title={item.directory}
							onSelect={() => onSelect(item.id)}
						>
							<Folder />
							<span className="min-w-0 flex-1 truncate">{item.name}</span>
							{item.id === coding.projectId && <Check className="ml-auto" />}
						</DropdownMenuItem>
					))}
					<DropdownMenuItem
						disabled={coding.busy || coding.loading}
						onSelect={() => {
							if (onBeforeChange()) void coding.addProject();
						}}
					>
						<FolderPlus />
						Open project folder
					</DropdownMenuItem>
					<DropdownMenuSeparator />
					{project && (
						<>
							<DropdownMenuItem
								disabled={!project.available}
								onSelect={() => onInstructions(project.id)}
							>
								<FileText />
								Agent instructions
							</DropdownMenuItem>
							<DropdownMenuItem
								disabled={!project.available}
								onSelect={() => void coding.openProject(project.id)}
							>
								<FolderOpen />
								Open folder
							</DropdownMenuItem>
						</>
					)}
					<DropdownMenuItem
						onSelect={onConfiguration}
						aria-current={settingsActive ? 'page' : undefined}
					>
						<Settings />
						Settings
					</DropdownMenuItem>
					{project && (
						<>
							<DropdownMenuSeparator />
							<DropdownMenuItem
								className="text-destructive"
								disabled={coding.busy || coding.loading}
								onSelect={() => {
									if (onBeforeChange()) void coding.removeProject(project.id);
								}}
							>
								<Trash2 />
								Remove workspace
							</DropdownMenuItem>
						</>
					)}
				</DropdownMenuContent>
			</DropdownMenu>
		</div>
	);
}
