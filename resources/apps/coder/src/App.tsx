import { useCallback, useState } from 'react';

import { Configuration } from '@/components/configuration';
import { Files } from '@/components/files';
import { Header } from '@/components/header';
import { Instructions } from '@/components/instructions';
import { ProjectSidebar } from '@/components/sidebar';
import { Project } from '@/components/project';
import { RightSidebar } from '@/components/ui/right';
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
	const [page, setPage] = useState<'workspace' | 'configuration' | 'instructions' | 'files' | 'project'>('workspace');
	const [instructionsDirty, setInstructionsDirty] = useState(false);
	const [rightOpen, setRightOpen] = useState(true);
	const setSidebarVisibility = useCallback(
		(open: boolean): void => {
			setLeftOpen(open);
		},
		[setLeftOpen]
	);

	const openPage = (nextPage: 'workspace' | 'configuration' | 'instructions' | 'files' | 'project'): boolean => {
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
							onOpenWorkspace={() => openPage('workspace')}
							onOpenFiles={(projectId) => { void coding.selectProject(projectId); void openPage('files'); }}
							onOpenInstructions={(projectId) => { void coding.selectProject(projectId); void openPage('instructions'); }}
							onOpenProject={(projectId) => { void coding.selectProject(projectId); void openPage('project'); }}
						/>
					</Sidebar>
					<SidebarInset>
						<Header
							coding={coding}
							onOpenConfiguration={() => void openPage('configuration')}
							onOpenInstructions={() => void openPage('instructions')}
							onOpenRightSidebar={() => setRightOpen(true)}
							rightSidebarOpen={rightOpen}
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
							) : page === 'files' && coding.activeProject ? (
								<Files coding={coding} onDone={() => void openPage('workspace')} />
							) : page === 'project' && coding.activeProject ? (
								<Project coding={coding} onOpenConfiguration={() => void openPage('configuration')} onOpenFiles={() => void openPage('files')} onOpenInstructions={() => void openPage('instructions')} />
							) : coding.activeProject ? (
								<Project coding={coding} onOpenConfiguration={() => void openPage('configuration')} onOpenFiles={() => void openPage('files')} onOpenInstructions={() => void openPage('instructions')} />
							) : null}
						</div>
					</SidebarInset>
					<RightSidebar open={rightOpen} onOpenChange={setRightOpen}>
						<Workspace coding={coding} />
					</RightSidebar>
				</main>
			</SidebarProvider>
		</TooltipProvider>
	);
}
