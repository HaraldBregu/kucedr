import { Check, ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { CodingProject } from '@shared/coding_types';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

interface WorkspaceSelectorProps {
	readonly workspace: CodingProject;
	readonly workspaces: readonly CodingProject[];
	readonly onSelect: (id: string) => void;
}

export function WorkspaceSelector({ workspace, workspaces, onSelect }: WorkspaceSelectorProps): React.JSX.Element {
	const { t } = useTranslation();
	return (
		<div className="-mx-2 min-w-0 flex-1">
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button variant="ghost" className="w-full min-w-0 justify-start px-4" aria-label={t('code.workspaces', 'Workspaces')}>
						<span className="min-w-0 flex-1 truncate text-left">{workspace.name}</span><ChevronDown />
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="start" className="max-h-80 w-[var(--radix-dropdown-menu-trigger-width)] min-w-0 overflow-y-auto">
					{workspaces.map((item) => <DropdownMenuItem key={item.id} onSelect={() => onSelect(item.id)}><span className="min-w-0 flex-1 truncate">{item.name}</span>{item.id === workspace.id && <Check />}</DropdownMenuItem>)}
				</DropdownMenuContent>
			</DropdownMenu>
			{!workspace.available && <p className="px-2.5 text-xs text-muted-foreground">{t('code.unavailable', 'Folder unavailable')}</p>}
		</div>
	);
}
