import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { Group, Panel, Separator } from 'react-resizable-panels';
import { useLocation, useMatch, useNavigate } from 'react-router-dom';
import { PageContainer, Split } from '@/components/app/base/page';
import { CodeSidebar } from './Sidebar';
import { WorkspaceSettings } from './Configuration';
import { CodeSettings } from './Settings';
import { CodeWorkbench } from './Workbench';
import { NewWorkspace } from './New';
import { CodeEmpty } from './Empty';

export default function CodePage({ settings = false }: { readonly settings?: boolean }): React.JSX.Element {
	const basePath = settings ? '/settings/code' : '/code';
	const { t } = useTranslation();
	const location = useLocation();
	const navigate = useNavigate();
	const workspaceSettings = useMatch(`${basePath}/workspaces/:projectId/settings`);
	const [file, setFile] = useState<{ projectId: string; fileName: string } | null>(null);
	const [workspaceRevision, setWorkspaceRevision] = useState(0);
	const [creation, setCreation] = useState<'markdown' | 'instructions' | null>(null);
	const [canCreateFile, setCanCreateFile] = useState(false);
	const codeLabel = t('navigationBar.code', 'Code');

	const sidebar = <CodeSidebar basePath={basePath} onDeleteFile={(projectId, fileName) => setFile((current) => current?.projectId === projectId && current.fileName === fileName ? null : current)} creation={creation} onCreationChange={setCreation} onFileCreationAvailable={setCanCreateFile} refreshKey={workspaceRevision} title={codeLabel} selectedFile={file} onSelectWorkspace={() => setFile(null)} onOpenFile={(projectId, fileName) => { setFile({ projectId, fileName }); navigate(basePath); }} />;
	const content = workspaceSettings ? <WorkspaceSettings key={workspaceSettings.params.projectId} projectId={workspaceSettings.params.projectId!} onClose={() => navigate(basePath)} onSaved={() => setWorkspaceRevision((value) => value + 1)} /> : location.pathname === `${basePath}/new` ? <NewWorkspace onCancel={() => navigate(basePath)} onCreated={(workspace) => { localStorage.setItem('coder-workspace', workspace.id); setFile(null); setWorkspaceRevision((value) => value + 1); navigate(basePath); }} /> : location.pathname === `${basePath}/settings` ? <CodeSettings onClose={() => navigate(basePath)} /> : file ? <CodeWorkbench key={file.projectId} projectId={file.projectId} fileName={file.fileName} /> : <CodeEmpty canCreateFile={canCreateFile} onCreateWorkspace={() => navigate(`${basePath}/new`)} onCreateFile={() => setCreation('markdown')} />;
	if (settings) {
		return (
			<Group orientation="horizontal" className="h-full min-h-0 bg-background" aria-label={codeLabel}>
				<Panel id="code-files" defaultSize="30%" minSize="20%" maxSize="60%" className="min-w-0">
					{sidebar}
				</Panel>
				<Separator aria-label={t('code.resize', 'Resize code files')} className="relative w-px shrink-0 bg-border outline-none after:absolute after:inset-y-0 after:-left-1 after:w-2 hover:bg-ring focus-visible:bg-ring" />
				<Panel id="code-content" minSize="40%" className="flex min-w-0 flex-col">
					{content}
				</Panel>
			</Group>
		);
	}
	return (
		<PageContainer className="overflow-hidden text-foreground">
			<Split sidebar={sidebar} sidebarLabel={codeLabel}>
				{content}
			</Split>
		</PageContainer>
	);
}
