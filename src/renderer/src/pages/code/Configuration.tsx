import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { CodingProject } from '@shared/coding_types';
import { Button } from '@/components/ui/button';
import { CodeSettings } from './Settings';

export function WorkspaceSettings({ projectId, onClose, onSaved }: { readonly projectId: string; readonly onClose: () => void; readonly onSaved: () => void }): React.JSX.Element {
	const { t } = useTranslation();
	const [project, setProject] = useState<CodingProject | null>(null);
	const [error, setError] = useState('');
	const [attempt, setAttempt] = useState(0);
	useEffect(() => {
		let active = true;
		setError('');
		void window.coder.listProjects().then((projects) => {
			if (!active) return;
			const selected = projects.find((item) => item.id === projectId);
			if (!selected) throw new Error(t('codeWorkspace.missing', 'Workspace not found.'));
			setProject(selected);
		}).catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : t('codeWorkspace.loadError', 'Unable to load workspace settings.')); });
		return () => { active = false; };
	}, [projectId, attempt, t]);
	if (project) return <CodeSettings project={project} onClose={onClose} onSaved={onSaved} />;
	return <div className="space-y-3 p-6">{error ? <><p role="alert" className="text-sm text-destructive">{error}</p><Button variant="outline" onClick={() => setAttempt((value) => value + 1)}>{t('codeWorkspace.retry', 'Retry')}</Button><Button variant="ghost" onClick={onClose}>{t('common.cancel', 'Cancel')}</Button></> : <p role="status" className="text-sm text-muted-foreground">{t('codeSettings.loading', 'Loading settings…')}</p>}</div>;
}
