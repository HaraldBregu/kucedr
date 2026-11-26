import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DEFAULT_WORKSPACE, type WorkspaceInfo } from '@shared/workspaces_types';

export function Space({ workspace, large = false }: { readonly workspace: WorkspaceInfo; readonly large?: boolean }): ReactElement {
	const { t } = useTranslation();
	const name = workspace.id === DEFAULT_WORKSPACE ? t('spaces.personal') : workspace.name;
	const status = workspace.missing
		? t('spaces.missing')
		: [
				workspace.running ? t('spaces.running', { count: workspace.running }) : '',
				workspace.waiting ? t('spaces.waiting', { count: workspace.waiting }) : '',
			]
				.filter(Boolean)
				.join(' · ');
	return (
		<>
			<Avatar className={large ? 'size-8 rounded-lg' : 'size-5 rounded-md'}>
				{workspace.image && <AvatarImage src={workspace.image} alt="" />}
				<AvatarFallback className={large ? 'rounded-lg text-sm font-medium' : 'rounded-md text-xs font-medium'}>
					{name.slice(0, 1).toUpperCase()}
				</AvatarFallback>
			</Avatar>
			<span className="min-w-0 flex-1 truncate text-left">
				{name}
				{status && <span className="text-muted-foreground"> · {status}</span>}
			</span>
		</>
	);
}
