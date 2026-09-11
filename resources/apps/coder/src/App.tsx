import { useCallback, useState } from 'react';

import { Configuration } from '@/components/configuration';
import { Header } from '@/components/header';
import { Instructions } from '@/components/instructions';
import { ProjectSidebar } from '@/components/sidebar';
import { Sidebar, SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Workspace } from '@/components/workspace';
import { useCodingWorkspace } from '@/hooks/workspace';
import { useTheme } from '@/hooks/use-theme';
import { canLeaveInstructions } from '@/navigation';

export default function App() {
	useTheme();
	const coding = useCodingWorkspace();
	const setLeftOpen = coding.setLeftOpen;
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
			<SidebarProvider open={coding.leftOpen} onOpenChange={setSidebarVisibility}>
				<main className="flex h-full min-h-0 w-full bg-background text-foreground">
					<Sidebar aria-label="Coder workspaces and sessions">
						<ProjectSidebar
							coding={coding}
							configurationOpen={page === 'configuration'}
							onOpenConfiguration={() => void openPage('configuration')}
							onOpenWorkspace={() => openPage('workspace')}
						/>
					</Sidebar>
					<SidebarInset>
						<Header
							coding={coding}
							onOpenConfiguration={() => void openPage('configuration')}
							onOpenInstructions={() => void openPage('instructions')}
							onOpenSidebar={() => setSidebarVisibility(true)}
							sidebarOpen={coding.leftOpen}
						/>
						<div className="flex min-h-0 flex-1 flex-col">
							{page === 'configuration' ? (
								<Configuration
									onDone={() => {
										void coding.refresh();
										openPage('workspace');
									}}
								/>
							) : page === 'instructions' && coding.activeProject ? (
								<Instructions
									projectId={coding.activeProject.id}
									projectName={coding.activeProject.name}
									onDirtyChange={setInstructionsDirty}
									onDone={() => void openPage('workspace')}
								/>
							) : (
								<Workspace coding={coding} />
							)}
						</div>
					</SidebarInset>
				</main>
			</SidebarProvider>
		</TooltipProvider>
	);
}
