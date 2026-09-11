import { useCallback, useState } from 'react';

import { Configuration } from '@/components/configuration';
import { Header } from '@/components/header';
import { Instructions } from '@/components/instructions';
import { ProjectSidebar } from '@/components/sidebar';
import { Sidebar, SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Workspace } from '@/components/workspace';
import { useCoderWorkspace } from '@/hooks/workspace';
import { useTheme } from '@/hooks/use-theme';
import { canLeaveInstructions } from '@/navigation';

export default function App() {
	useTheme();
	const coder = useCoderWorkspace();
	const setLeftOpen = coder.setLeftOpen;
	const [page, setPage] = useState<'workspace' | 'configuration' | 'instructions'>('workspace');
	const [instructionsDirty, setInstructionsDirty] = useState(false);
	const setSidebarVisibility = useCallback(
		(open: boolean): void => {
			setLeftOpen(open);
		},
		[setLeftOpen]
	);

	const openPage = (nextPage: 'workspace' | 'configuration' | 'instructions'): boolean => {
		if (nextPage !== 'instructions' && !canLeaveInstructions(page, instructionsDirty)) {
			return false;
		}
		setPage(nextPage);
		if (nextPage !== 'instructions') setInstructionsDirty(false);
		return true;
	};

	return (
		<TooltipProvider>
			<SidebarProvider open={coder.leftOpen} onOpenChange={setSidebarVisibility}>
				<main className="flex h-full min-h-0 w-full bg-background text-foreground">
					<Sidebar aria-label="Coder workspaces and sessions">
						<ProjectSidebar
							coder={coder}
							configurationOpen={page === 'configuration'}
							onOpenConfiguration={() => void openPage('configuration')}
							onOpenWorkspace={() => openPage('workspace')}
						/>
					</Sidebar>
					<SidebarInset>
						<Header coder={coder} onOpenInstructions={() => void openPage('instructions')} />
						<div className="flex min-h-0 flex-1 flex-col">
							{page === 'configuration' ? (
								<Configuration
									onDone={() => {
										void coder.refresh();
										openPage('workspace');
									}}
								/>
							) : page === 'instructions' && coder.activeProject ? (
								<Instructions
									projectId={coder.activeProject.id}
									projectName={coder.activeProject.name}
									onDirtyChange={setInstructionsDirty}
									onDone={() => void openPage('workspace')}
								/>
							) : (
								<Workspace coder={coder} />
							)}
						</div>
					</SidebarInset>
				</main>
			</SidebarProvider>
		</TooltipProvider>
	);
}
