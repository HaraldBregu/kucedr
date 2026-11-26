import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
	AlertTriangle,
	FolderCheck,
	FolderOpen,
	FolderX,
	Plus,
	RotateCcw,
	Save,
	Trash2,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import {
	SettingsEmptyState,
	SettingsLoadingRows,
	SettingsNotice,
	SettingsPageHeader,
	SettingsPageShell,
	SettingsPanel,
	SettingsRow,
	SettingsSection,
} from '../../components';
import Sandbox from './Sandbox';

type Permissions = Awaited<ReturnType<typeof window.agent.policyGet>>;
type PermissionKind = 'read' | 'write' | 'exec';
type PermissionBucket = 'allow' | 'deny';
type PermissionRule = Permissions[PermissionKind][PermissionBucket][number];

const KINDS: PermissionKind[] = ['read', 'write', 'exec'];
const ruleKey = (rule: PermissionRule): string => `${rule.recursive}:${rule.root}`;

const PermissionsPage: React.FC = () => {
	const { t } = useTranslation();
	const [permissions, setPermissions] = useState<Permissions | null>(null);
	const [workspace, setWorkspace] = useState('');
	const [newPath, setNewPath] = useState('');
	const [newBucket, setNewBucket] = useState<PermissionBucket>('allow');
	const [newKinds, setNewKinds] = useState<PermissionKind[]>(KINDS);
	const [error, setError] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);
	const savingRef = useRef(false);

	const apply = (operation: () => Promise<Permissions>): void => {
		if (savingRef.current) return;
		savingRef.current = true;
		setSaving(true);
		setError(null);
		operation()
			.then(setPermissions)
			.catch((cause: unknown) => {
				setError(cause instanceof Error ? cause.message : t('settings.permissions.saveFailed'));
			})
			.finally(() => {
				savingRef.current = false;
				setSaving(false);
			});
	};

	useEffect(() => {
		Promise.all([window.agent.policyGet(), window.agent.getWorkspaceLocation()])
			.then(([rules, location]) => {
				setPermissions(rules);
				setWorkspace(location);
			})
			.catch((cause: unknown) => {
				setError(cause instanceof Error ? cause.message : String(cause));
			});
	}, []);

	const rows = permissions
		? (['allow', 'deny'] as const).flatMap((bucket) => {
				const rules = [
					...new Map(
						KINDS.flatMap((kind) => permissions[kind][bucket]).map((rule) => [ruleKey(rule), rule])
					).values(),
				];
				return rules.map((rule) => ({
					bucket,
					rule,
					path: rule.root,
					kinds: KINDS.filter((kind) =>
						permissions[kind][bucket].some((candidate) => ruleKey(candidate) === ruleKey(rule))
					),
				}));
			})
		: [];
	const protectedRows = permissions
		? [
				...permissions.protected.read.map((path) => ({ path, kinds: KINDS.slice(0, 2) })),
				...permissions.protected.write.map((path) => ({ path, kinds: KINDS.slice(1, 2) })),
			]
		: [];
	const workspaceKey = workspace.replaceAll('\\', '/').replace(/\/$/, '');
	const workspaceRow = rows.find(
		(row) =>
			row.bucket === 'allow' &&
			row.rule.recursive &&
			row.path.replaceAll('\\', '/').replace(/\/$/, '') === workspaceKey &&
			row.kinds.length === KINDS.length
	);
	const customRows = rows.filter((row) => row !== workspaceRow);

	const addLocation = async (): Promise<void> => {
		if (!permissions || !newPath.trim() || newKinds.length === 0) return;
		setError(null);
		let normalized: string;
		try {
			normalized = await window.agent.policyNormalizeDirectory(newPath);
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : String(cause));
			return;
		}
		const rule: PermissionRule = { root: normalized, recursive: true };
		const opposite: PermissionBucket = newBucket === 'allow' ? 'deny' : 'allow';
		setPermissions(
			KINDS.reduce(
				(next, kind) =>
					newKinds.includes(kind)
						? {
								...next,
								[kind]: {
									...next[kind],
									[newBucket]: [
										...next[kind][newBucket].filter(
											(candidate) => ruleKey(candidate) !== ruleKey(rule)
										),
										rule,
									],
									[opposite]: next[kind][opposite].filter(
										(candidate) => candidate.root !== normalized
									),
								},
							}
						: next,
				permissions
			)
		);
		setNewPath('');
	};

	const removeLocation = (rule: PermissionRule, bucket: PermissionBucket): void => {
		if (!permissions) return;
		setPermissions(
			KINDS.reduce(
				(next, kind) => ({
					...next,
					[kind]: {
						...next[kind],
						[bucket]: next[kind][bucket].filter(
							(candidate) => ruleKey(candidate) !== ruleKey(rule)
						),
					},
				}),
				permissions
			)
		);
	};

	return (
		<SettingsPageShell>
			<SettingsPageHeader
				title={t('settings.tabs.permissions')}
				description={t('settings.overview.descriptions.permissions')}
				action={
					<div className="flex gap-2">
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={() => apply(() => window.agent.policyReset())}
							disabled={saving}
						>
							<RotateCcw className="size-3" />
							{t('settings.permissions.reset')}
						</Button>
						<Button
							type="button"
							size="sm"
							onClick={() =>
								permissions &&
								apply(() =>
									window.agent.policySet({
										read: permissions.read,
										write: permissions.write,
										exec: permissions.exec,
									})
								)
							}
							disabled={!permissions || saving}
						>
							<Save className="size-3" />
							{t('common.save')}
						</Button>
					</div>
				}
			/>

			{error && (
				<SettingsNotice variant="destructive" icon={AlertTriangle}>
					{error}
				</SettingsNotice>
			)}
			{permissions && permissions.dropped.length > 0 && (
				<SettingsNotice icon={AlertTriangle}>
					{t('settings.permissions.droppedNotice', {
						count: permissions.dropped.length,
						rules: permissions.dropped.join(', '),
					})}
				</SettingsNotice>
			)}
			<SettingsNotice>{t('settings.permissions.locationsNotice')}</SettingsNotice>
			<Sandbox />

			{!permissions ? (
				<SettingsLoadingRows rows={3} />
			) : (
				<SettingsSection
					title={t('settings.permissions.locationsTitle')}
					description={t('settings.permissions.locationsDescription')}
				>
					<SettingsPanel>
						<SettingsRow
							icon={FolderCheck}
							title={<span className="break-all font-mono text-xs">{workspace}</span>}
							description={t('settings.permissions.workspaceDescription')}
							actions={<Badge variant="secondary">{t('settings.permissions.trusted')}</Badge>}
						/>
						{customRows.length === 0 && <SettingsEmptyState icon={FolderOpen} title={t('settings.permissions.emptyTitle')} description={t('settings.permissions.emptyDescription')} />}
						{customRows.map((row) => (
							<SettingsRow
								key={`${row.bucket}:${ruleKey(row.rule)}`}
								icon={row.bucket === 'allow' ? FolderCheck : FolderX}
								title={<span className="break-all font-mono text-xs">{row.path}</span>}
								description={[
									...row.kinds.map((kind) => t(`settings.permissions.kinds.${kind}.title`)),
									...(row.rule.recursive ? [] : [t('settings.permissions.exactPath')]),
								].join(' · ')}
								actions={
									<>
										<Badge variant={row.bucket === 'allow' ? 'secondary' : 'destructive'}>
											{t(
												row.bucket === 'allow'
													? 'settings.permissions.trusted'
													: 'settings.permissions.blocked'
											)}
										</Badge>
										<Button
											type="button"
											size="icon-sm"
											variant="ghost"
											aria-label={t('settings.permissions.removeLocation')}
											title={t('settings.permissions.removeLocation')}
											onClick={() => removeLocation(row.rule, row.bucket)}
											disabled={saving}
										>
											<Trash2 className="size-3" />
										</Button>
									</>
								}
							/>
						))}
						<div className="space-y-2 border-t border-border/60 p-4">
							<div className="flex flex-col gap-2 sm:flex-row">
								<Input
									aria-label={t('settings.permissions.pathLabel')}
									value={newPath}
									onChange={(event) => setNewPath(event.target.value)}
									placeholder={t('settings.permissions.pathPlaceholder')}
									disabled={saving}
								/>
								<Button
									type="button"
									variant="outline"
									size="icon"
									aria-label={t('settings.permissions.browse')}
									onClick={() =>
										void window.agent
											.policyPickDirectory()
											.then((value) => value && setNewPath(value))
											.catch((cause: unknown) =>
												setError(cause instanceof Error ? cause.message : String(cause))
											)
									}
									disabled={saving}
								>
									<FolderOpen className="size-4" />
								</Button>
								<Select
									value={newBucket}
									onValueChange={(value) => setNewBucket(value as PermissionBucket)}
									disabled={saving}
								>
									<SelectTrigger size="sm" aria-label={t('settings.permissions.accessLabel')}>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="allow">{t('settings.permissions.trusted')}</SelectItem>
										<SelectItem value="deny">{t('settings.permissions.blocked')}</SelectItem>
									</SelectContent>
								</Select>
								<Button
									type="button"
									size="sm"
									onClick={() => void addLocation()}
									disabled={saving || !newPath.trim() || newKinds.length === 0}
								>
									<Plus className="size-3" /> {t('settings.permissions.add')}
								</Button>
							</div>
							<fieldset className="flex flex-wrap gap-3">
								<legend className="sr-only">{t('settings.permissions.toolsLabel')}</legend>
								{KINDS.map((kind) => (
									<label
										key={kind}
										className="flex items-center gap-1.5 text-xs text-muted-foreground"
									>
										<input
											type="checkbox"
											checked={newKinds.includes(kind)}
											onChange={(event) =>
												setNewKinds(
													event.target.checked
														? [...newKinds, kind]
														: newKinds.filter((value) => value !== kind)
												)
											}
											disabled={saving}
										/>
										{t(`settings.permissions.kinds.${kind}.title`)}
									</label>
								))}
							</fieldset>
						</div>
					</SettingsPanel>
				</SettingsSection>
			)}

			{permissions && (
				<SettingsSection
					title={t('settings.permissions.protectedTitle')}
					description={t('settings.permissions.protectedDescription')}
				>
					<SettingsPanel>
						{protectedRows.map((row) => (
							<SettingsRow
								key={row.path}
								icon={FolderX}
								title={<span className="break-all font-mono text-xs">{row.path}</span>}
								description={row.kinds
									.map((kind) => t(`settings.permissions.kinds.${kind}.title`))
									.join(' · ')}
								actions={<Badge variant="outline">{t('settings.permissions.builtIn')}</Badge>}
							/>
						))}
					</SettingsPanel>
				</SettingsSection>
			)}
		</SettingsPageShell>
	);
};

export default PermissionsPage;
