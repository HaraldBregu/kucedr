import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { PageContainer, Split } from '@/components/app/base/page';
import { CodeSidebar } from './Sidebar';
import { CodeSettings } from './Settings';
import { CodeWorkbench } from './Workbench';
import { NewWorkspace } from './New';
import { CodeEmpty } from './Empty';

export default function CodePage(): React.JSX.Element {
	const { t } = useTranslation();
	const location = useLocation();
	const navigate = useNavigate();
	const [file, setFile] = useState<{ projectId: string; fileName: string } | null>(null);
	const [workspaceRevision, setWorkspaceRevision] = useState(0);
	const [creation, setCreation] = useState<'markdown' | 'instructions' | null>(null);
	const [canCreateFile, setCanCreateFile] = useState(false);
	const codeLabel = t('navigationBar.code', 'Code');

	return (
		<PageContainer className="overflow-hidden text-foreground">
			<Split sidebar={<CodeSidebar onDeleteFile={(projectId, fileName) => setFile((current) => current?.projectId === projectId && current.fileName === fileName ? null : current)} creation={creation} onCreationChange={setCreation} onFileCreationAvailable={setCanCreateFile} refreshKey={workspaceRevision} title={codeLabel} selectedFile={file} onSelectWorkspace={() => setFile(null)} onOpenFile={(projectId, fileName) => { setFile({ projectId, fileName }); navigate('/code'); }} />} sidebarLabel={codeLabel}>
				{location.pathname === '/code/new' ? <NewWorkspace onCancel={() => navigate('/code')} onCreated={(workspace) => { localStorage.setItem('coder-workspace', workspace.id); setFile(null); setWorkspaceRevision((value) => value + 1); navigate('/code'); }} /> : location.pathname === '/code/settings' ? <CodeSettings onClose={() => navigate('/code')} /> : file ? <CodeWorkbench key={file.projectId} projectId={file.projectId} fileName={file.fileName} /> : <CodeEmpty canCreateFile={canCreateFile} onCreateWorkspace={() => navigate('/code/new')} onCreateFile={() => setCreation('markdown')} />}
			</Split>
		</PageContainer>
	);
}
