import { useEffect, useState } from 'react';
import { AlertTriangle, Download, FolderOpen } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import type { StorageBackupSnapshot } from '@shared/storage_types';
import { SettingsField, SettingsNotice } from '../../components';

interface RestoreProps {
	readonly open: boolean;
	readonly disabled: boolean;
	readonly versioned: boolean;
	readonly hasFolders: boolean;
	readonly onOpenChange: (open: boolean) => void;
	readonly onRestore: (input?: { snapshotKey: string; path: string }) => void;
}

export default function Restore({
	open,
	disabled,
	versioned,
	hasFolders,
	onOpenChange,
	onRestore,
}: RestoreProps): React.JSX.Element {
	const { t } = useTranslation();
	const [snapshots, setSnapshots] = useState<StorageBackupSnapshot[]>([]);
	const [source, setSource] = useState('latest');
	const [destination, setDestination] = useState('');
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState('');
	const [loadVersion, setLoadVersion] = useState(0);

	useEffect(() => {
		if (!open || versioned) return;
		let cancelled = false;
		setSource('latest');
		setDestination('');
		setLoading(true);
		setError('');
		void window.storage
			.listSnapshots()
			.then((saved) => {
				if (!cancelled) setSnapshots(saved);
			})
			.catch(() => {
				if (!cancelled) setError(t('settings.storage.restoreDialog.loadError'));
			})
			.finally(() => {
				if (!cancelled) setLoading(false);
			});
		return () => {
			cancelled = true;
		};
	}, [open, versioned, loadVersion, t]);

	const selectedSnapshot = snapshots.find((snapshot) => snapshot.key === source);
	const title = t(
		versioned ? 'settings.storage.versioned.catchUp' : 'settings.storage.restoreDialog.title'
	);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{title}</DialogTitle>
					<DialogDescription>
						{t(
							versioned
								? 'settings.storage.versioned.catchUpDescription'
								: 'settings.storage.restoreDialog.description'
						)}
					</DialogDescription>
				</DialogHeader>
				{!versioned && (
					<div className="grid min-w-0 gap-4">
						{error && (
							<div className="grid gap-2">
								<SettingsNotice variant="destructive" icon={AlertTriangle}>
									{error}
								</SettingsNotice>
								<Button
									variant="outline"
									size="sm"
									onClick={() => setLoadVersion((current) => current + 1)}
								>
									{t('common.tryAgain')}
								</Button>
							</div>
						)}
						<SettingsField id="restore-source" label={t('settings.storage.restoreDialog.source')}>
							<Select
								value={source}
								disabled={disabled || loading}
								onValueChange={(value) => {
									setSource(value ?? 'latest');
									setDestination('');
								}}
							>
								<SelectTrigger id="restore-source" className="w-full min-w-0">
									<SelectValue>
										{source === 'latest'
											? t('settings.storage.restoreDialog.latest')
											: selectedSnapshot
												? `${selectedSnapshot.folder} · ${new Date(selectedSnapshot.createdAt).toLocaleString()}`
												: ''}
									</SelectValue>
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="latest">
										{t('settings.storage.restoreDialog.latest')}
									</SelectItem>
									{snapshots.map((snapshot) => (
										<SelectItem key={snapshot.key} value={snapshot.key}>
											{snapshot.folder} · {new Date(snapshot.createdAt).toLocaleString()}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</SettingsField>
						{loading && (
							<p role="status" className="text-xs text-muted-foreground">
								{t('settings.storage.restoreDialog.loading')}
							</p>
						)}
						{source !== 'latest' && (
							<SettingsField
								id="restore-destination"
								label={t('settings.storage.restoreDialog.destination')}
								description={t('settings.storage.restoreDialog.destinationHint')}
							>
								<Button
									id="restore-destination"
									variant="outline"
									disabled={disabled}
									className="h-auto min-h-8 w-full justify-start whitespace-normal break-all text-left"
									onClick={() => {
										void window.storage
											.pickFolders()
											.then((paths) => {
												if (paths[0]) setDestination(paths[0]);
											})
											.catch(() => setError(t('settings.storage.errors.pickFolders')));
									}}
								>
									<FolderOpen className="size-3.5" />
									{destination || t('settings.storage.restoreDialog.chooseDestination')}
								</Button>
							</SettingsField>
						)}
					</div>
				)}
				<DialogFooter>
					<Button variant="outline" onClick={() => onOpenChange(false)}>
						{t('settings.storage.cancel')}
					</Button>
					<Button
						disabled={
							disabled || (source === 'latest' ? !hasFolders : !selectedSnapshot || !destination)
						}
						onClick={() =>
							onRestore(
								source === 'latest' || versioned
									? undefined
									: { snapshotKey: source, path: destination }
							)
						}
					>
						<Download className="size-3" />
						{t(
							versioned
								? 'settings.storage.versioned.catchUp'
								: 'settings.storage.restoreDialog.confirm'
						)}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
