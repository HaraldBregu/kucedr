import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { PageContainer, Split } from '@/components/app/base/page';
import { CodeSidebar } from './Sidebar';
import { CodeSettings } from './Settings';
import { CodeFileViewer } from './Viewer';
import { NewWorkspace } from './New';

export default function CodePage(): React.JSX.Element {
	const { t } = useTranslation();
	const location = useLocation();
	const navigate = useNavigate();
	const [file, setFile] = useState<{ projectId: string; fileName: string } | null>(null);
	const [workspaceRevision, setWorkspaceRevision] = useState(0);
	const codeLabel = t('navigationBar.code', 'Code');

	return (
		<PageContainer className="overflow-hidden text-foreground">
			<Split sidebar={<CodeSidebar refreshKey={workspaceRevision} title={codeLabel} selectedFile={file} onSelectWorkspace={() => setFile(null)} onOpenFile={(projectId, fileName) => { setFile({ projectId, fileName }); navigate('/code'); }} />} sidebarLabel={codeLabel}>
				{location.pathname === '/code/new' ? <NewWorkspace onCancel={() => navigate('/code')} onCreated={(workspace) => { localStorage.setItem('coder-workspace', workspace.id); setFile(null); setWorkspaceRevision((value) => value + 1); navigate('/code'); }} /> : location.pathname === '/code/settings' ? <CodeSettings onClose={() => navigate('/code')} /> : file ? <CodeFileViewer key={`${file.projectId}:${file.fileName}`} projectId={file.projectId} fileName={file.fileName} /> : <div className="h-full min-h-0 flex-1" />}
			</Split>
		</PageContainer>
	);
}
