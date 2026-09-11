import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { isKucedr, win } from '@kucedr/sdk';

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
	const activeSession = coder.sessions.find((item) => item.id === coder.activeSessionId);
	const title =
		page === 'configuration'
			? 'Coder · Configuration'
			: page === 'instructions'
				? `Coder · ${coder.activeProject?.name ?? 'Agent instructions'}`
				: [coder.activeProject?.name, activeSession?.title].filter(Boolean).join(' · ') || 'Coder';

	const syncTitlebar = useCallback((open: boolean): void => {
		if (!isKucedr()) return;
		win.setTitlebarOptions({
			title,
			leftButtons: [
				{
					id: 'toggle-sidebar',
					label: open ? 'Collapse project navigation' : 'Expand project navigation',
					icon: 'panel-left',
					expanded: open,
				},
			],
			rightButtons: [],
			sidebarOpen: open,
			sidebarWidth: 288,
		});
	}, [title]);

	const setSidebarVisibility = useCallback(
		(open: boolean): void => {
			syncTitlebar(open);
			setLeftOpen(open);
		},
		[setLeftOpen, syncTitlebar]
	);

	useLayoutEffect(() => {
		syncTitlebar(coder.leftOpen);
	}, [coder.leftOpen, syncTitlebar]);

	useEffect(() => {
		if (!isKucedr()) return;
		return () => win.setTitlebarOptions(null);
	}, []);

	useEffect(() => {
		if (!isKucedr()) return;
		return win.onTitlebarButtonClick((buttonId) => {
			if (buttonId === 'toggle-sidebar') setSidebarVisibility(!coder.leftOpen);
		});
	}, [coder.leftOpen, setSidebarVisibility]);

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
							<>
								<Header coder={coder} onOpenInstructions={() => void openPage('instructions')} />
								<Workspace coder={coder} />
							</>
						)}
					</SidebarInset>
				</main>
			</SidebarProvider>
		</TooltipProvider>
	);
}
