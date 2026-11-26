import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DEFAULT_WORKSPACE, type WorkspaceInfo } from '@shared/workspaces_types';

export function Space({
	workspace,
	large = false,
	title = workspace.id === DEFAULT_WORKSPACE ? undefined : workspace.name,
	subtitle,
	showAvatarLabel = true,
}: {
	readonly workspace: WorkspaceInfo;
	readonly large?: boolean;
	readonly title?: string;
	readonly subtitle?: string;
	readonly showAvatarLabel?: boolean;
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
			<Avatar className={large ? 'size-6 rounded-sm bg-gradient-to-br from-amber-400 to-orange-600 text-white' : 'size-5 rounded-lg'}>
				{workspace.image && <AvatarImage src={workspace.image} alt="" />}
				<AvatarFallback
					className={large
						? 'rounded-sm bg-gradient-to-br from-amber-400 to-orange-600 text-sm font-medium text-white'
						: 'rounded-full text-xs font-medium'}
				>
					{showAvatarLabel ? name.slice(0, 1).toUpperCase() : null}
				</AvatarFallback>
			</Avatar>
			<span className="grid min-w-0 flex-1 truncate text-left leading-tight">
				<span className={large ? 'truncate text-base font-medium' : 'truncate'}>{name}</span>
				{subtitle ? (
					<span className="truncate text-[10px] text-muted-foreground">{subtitle}</span>
				) : status ? (
					<span className="truncate text-xs text-muted-foreground">{status}</span>
				) : null}
			</span>
		</>
	);
}
