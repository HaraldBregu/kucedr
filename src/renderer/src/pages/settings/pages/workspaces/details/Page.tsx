import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, Folders } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useSpaces } from '@/spaces/context';
import { DEFAULT_WORKSPACE, type WorkspaceContents } from '@shared/workspaces_types';
import {
	SettingsEmptyState,
	SettingsNotice,
	SettingsPageHeader,
	SettingsPageShell,
	SettingsPanel,
	SettingsRow,
	SettingsSection,
	SettingsValue,
} from '../../../components';
import { Delete } from './Delete';

const WorkspaceDetailsPage: React.FC = () => {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const { workspaceId = '' } = useParams<{ workspaceId: string }>();
	const { current, workspaces, select } = useSpaces();
	const [deleting, setDeleting] = useState(false);
	const workspace = workspaces.find((item) => item.id === workspaceId);
	const [name, setName] = useState('');
	const [contents, setContents] = useState<WorkspaceContents>();
	const [error, setError] = useState('');

	useEffect(() => setName(workspace?.name ?? ''), [workspace?.name]);
	useEffect(() => {
		void window.workspaces.contents(workspaceId).then(setContents, () => setContents(undefined));
	}, [workspaceId, workspaces]);

	if (!workspace) {
		return (
			<SettingsPageShell>
				<SettingsEmptyState icon={Folders} title={t('settings.workspaces.notFound')} />
			</SettingsPageShell>
		);
	}

	const personal = workspace.id === DEFAULT_WORKSPACE;
	const title = personal ? t('spaces.personal') : workspace.name;
	const attempt = (action: Promise<unknown>): Promise<boolean> => {
		setError('');
		return action.then(
			() => true,
			(reason: unknown) => {
				setError(reason instanceof Error ? reason.message : String(reason));
				return false;
			}
		);
	};
	const remove = (deleteChats: boolean): void => {
		setDeleting(false);
		void attempt(window.workspaces.remove(workspace.id, deleteChats)).then((removed) => {
			if (removed) void navigate('/settings/workspaces');
		});
	};

	return (
		<SettingsPageShell>
			<SettingsPageHeader
				title={title}
				description={personal ? t('settings.workspaces.personalDescription') : undefined}
				iconPosition="top"
				iconNode={
					<Avatar className="size-14 rounded-full">
						{workspace.image && <AvatarImage src={workspace.image} alt="" />}
						<AvatarFallback className="rounded-full text-xl">{title.slice(0, 1).toUpperCase()}</AvatarFallback>
					</Avatar>
				}
			/>
			{error && (
				<SettingsNotice variant="destructive" icon={AlertTriangle}>
					{error}
				</SettingsNotice>
			)}
			{workspace.missing && (
				<SettingsNotice variant="destructive" icon={AlertTriangle}>
					{t('spaces.missing')}
				</SettingsNotice>
			)}

			{!personal && (
				<SettingsSection title={t('settings.workspaces.profile')}>
					<SettingsPanel>
						<SettingsRow title={t('spaces.name')}>
							<form
								className="flex items-center gap-1.5"
								onSubmit={(event) => {
									event.preventDefault();
									void attempt(window.workspaces.rename(workspace.id, name));
								}}
							>
								<Input
									value={name}
									maxLength={64}
									aria-label={t('spaces.name')}
									className="h-8 w-56"
									onChange={(event) => setName(event.target.value)}
								/>
								<Button type="submit" size="sm" disabled={!name.trim() || name.trim() === workspace.name}>
									{t('common.save')}
								</Button>
							</form>
						</SettingsRow>
						<SettingsRow title={t('settings.workspaces.picture')} description={t('settings.workspaces.pictureDescription')}>
							<Button type="button" variant="outline" size="sm" onClick={() => void attempt(window.workspaces.pickImage(workspace.id))}>
								{t('spaces.picture')}
							</Button>
							{workspace.image && (
								<Button type="button" variant="outline" size="sm" onClick={() => void attempt(window.workspaces.removeImage(workspace.id))}>
									{t('spaces.removePicture')}
								</Button>
							)}
						</SettingsRow>
					</SettingsPanel>
				</SettingsSection>
			)}

			<SettingsSection title={t('settings.workspaces.folder')}>
				<SettingsPanel>
					<SettingsRow title={t('settings.workspaces.folder')} description={<span className="break-all">{workspace.folder}</span>}>
						{!workspace.missing && (
							<Button type="button" variant="outline" size="sm" onClick={() => void attempt(window.workspaces.reveal(workspace.id))}>
								{t('settings.workspaces.reveal')}
							</Button>
						)}
						{!personal && (
							<Button type="button" variant="outline" size="sm" onClick={() => void attempt(window.workspaces.locate(workspace.id))}>
								{t('spaces.locate')}
							</Button>
						)}
					</SettingsRow>
				</SettingsPanel>
			</SettingsSection>

			<SettingsSection title={t('settings.workspaces.data')}>
				<SettingsPanel>
					<SettingsRow title={t('settings.workspaces.chats')}>
						<SettingsValue>{contents?.chats.length ?? '—'}</SettingsValue>
					</SettingsRow>
					<SettingsRow title={t('settings.workspaces.running')}>
						<SettingsValue>{workspace.running ?? 0}</SettingsValue>
					</SettingsRow>
					<SettingsRow title={t('settings.workspaces.waiting')}>
						<SettingsValue>{workspace.waiting ?? 0}</SettingsValue>
					</SettingsRow>
					<SettingsRow title={t('settings.workspaces.shared')} description={t('settings.workspaces.sharedDescription')} />
					<SettingsRow title={t('settings.workspaces.id')}>
						<SettingsValue mono>{workspace.id}</SettingsValue>
					</SettingsRow>
				</SettingsPanel>
			</SettingsSection>

			<SettingsSection title={t('settings.workspaces.window')}>
				<SettingsPanel>
					<SettingsRow
						title={workspace.id === current ? t('settings.workspaces.current') : t('settings.workspaces.switch')}
						description={t('settings.workspaces.switchDescription')}
					>
						{workspace.id !== current && (
							<Button type="button" variant="outline" size="sm" disabled={workspace.missing} onClick={() => void attempt(select(workspace.id))}>
								{t('settings.workspaces.switch')}
							</Button>
						)}
						<Button type="button" variant="outline" size="sm" disabled={workspace.missing} onClick={() => void attempt(window.workspaces.openWindow(workspace.id))}>
							{t('spaces.openWindow')}
						</Button>
					</SettingsRow>
				</SettingsPanel>
			</SettingsSection>

			{!personal && (
				<SettingsSection title={t('settings.workspaces.danger')}>
					<SettingsPanel>
						<SettingsRow title={t('settings.workspaces.delete')} description={t('settings.workspaces.deleteHint')}>
							<Button type="button" variant="destructive" size="sm" disabled={!contents} onClick={() => setDeleting(true)}>
								{t('common.delete')}
							</Button>
						</SettingsRow>
					</SettingsPanel>
				</SettingsSection>
			)}
			{deleting && (
				<Delete name={title} contents={contents} onClose={() => setDeleting(false)} onConfirm={remove} />
			)}
		</SettingsPageShell>
	);
};

export default WorkspaceDetailsPage;
