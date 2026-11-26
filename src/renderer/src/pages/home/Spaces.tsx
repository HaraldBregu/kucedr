import { useState, type ReactElement } from 'react';
import { AppWindow, Check, ChevronsUpDown, FolderPlus, Pencil } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar';
import { useSpaces } from '@/spaces/context';
import { DEFAULT_WORKSPACE } from '@shared/workspaces_types';
import { Space } from './Space';
import { SpaceEdit } from './SpaceEdit';

export function Spaces(): ReactElement | null {
	const { t } = useTranslation();
	const { current, workspaces, select } = useSpaces();
	const [editing, setEditing] = useState(false);
	const [error, setError] = useState('');
	const shown = workspaces.find((workspace) => workspace.id === current);
	if (!shown) return null;
	const attempt = (action: Promise<unknown>): void => {
		setError('');
		void action.catch((reason: unknown) =>
			setError(reason instanceof Error ? reason.message : String(reason))
		);
	};
	return (
		<SidebarMenuItem>
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<SidebarMenuButton
						type="button"
						className="h-9 px-2.5 py-1.5 text-sm data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
						aria-label={t('spaces.switch')}
					>
						<Space workspace={shown} large title="Personal" showAvatarLabel={false} />
						<ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
					</SidebarMenuButton>
				</DropdownMenuTrigger>
				<DropdownMenuContent
					className="w-(--radix-dropdown-menu-trigger-width) min-w-56"
					align="start"
					side="right"
					sideOffset={4}
				>
					{workspaces.map((workspace) => (
						<DropdownMenuItem
							key={workspace.id}
							onSelect={() => {
								if (workspace.id !== current) attempt(select(workspace.id));
							}}
						>
							<Space workspace={workspace} />
							{workspace.id === current && <Check />}
						</DropdownMenuItem>
					))}
					<DropdownMenuSeparator />
					<DropdownMenuItem
						onSelect={() =>
							attempt(
								window.workspaces
									.create()
									.then((created) => (created ? select(created.id) : undefined))
							)
						}
					>
						<FolderPlus />
						{t('spaces.create')}
					</DropdownMenuItem>
					{current !== DEFAULT_WORKSPACE && (
						<DropdownMenuItem onSelect={() => setEditing(true)}>
							<Pencil />
							{t('spaces.edit')}
						</DropdownMenuItem>
					)}
					<DropdownMenuSub>
						<DropdownMenuSubTrigger>
							<AppWindow />
							{t('spaces.openWindow')}
						</DropdownMenuSubTrigger>
						<DropdownMenuSubContent className="min-w-48">
							{workspaces.map((workspace) => (
								<DropdownMenuItem
									key={workspace.id}
									onSelect={() => attempt(window.workspaces.openWindow(workspace.id))}
								>
									<Space workspace={workspace} />
								</DropdownMenuItem>
							))}
						</DropdownMenuSubContent>
					</DropdownMenuSub>
				</DropdownMenuContent>
			</DropdownMenu>
			{error && (
				<p role="alert" className="px-2.5 py-1 text-xs text-destructive">
					{error}
				</p>
			)}
			{editing && <SpaceEdit workspace={shown} onClose={() => setEditing(false)} />}
		</SidebarMenuItem>
	);
}
