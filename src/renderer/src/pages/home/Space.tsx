import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DEFAULT_WORKSPACE, type WorkspaceInfo } from '@shared/workspaces_types';

export function Space({
	workspace,
	large = false,
	title = workspace.id === DEFAULT_WORKSPACE ? undefined : workspace.name,
	subtitle,
}: {
	readonly workspace: WorkspaceInfo;
	readonly large?: boolean;
	readonly title?: string;
	readonly subtitle?: string;
}): ReactElement {
	const { t } = useTranslation();
	const name = title ?? (workspace.id === DEFAULT_WORKSPACE ? t('spaces.personal') : workspace.name);
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
			<span className="grid min-w-0 flex-1 truncate text-left leading-tight">
				<span className="truncate">{name}</span>
				{subtitle ? (
					<span className="truncate text-xs text-muted-foreground">{subtitle}</span>
				) : status ? (
					<span className="truncate text-xs text-muted-foreground">{status}</span>
				) : null}
			</span>
		</>
	);
}
