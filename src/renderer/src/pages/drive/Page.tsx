import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, CloudUpload, FolderOpen, Plus, RefreshCw, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { DriveFile, DriveUpdateInput } from '@shared/drive_types';
import { PageContainer, Split } from '@/components/app/base/page';
import { Button } from '@/components/ui/button';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { DriveFiles } from './Files';
import { DriveInspector } from './Inspector';

export default function DrivePage(): React.JSX.Element {
	const navigate = useNavigate();
	const [connected, setConnected] = useState<boolean | null>(null);
	const [files, setFiles] = useState<DriveFile[]>([]);
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [query, setQuery] = useState('');
	const [meetOnly, setMeetOnly] = useState(false);
	const [loading, setLoading] = useState(false);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState('');
	const [message, setMessage] = useState('');
	const [folderPath, setFolderPath] = useState('');
	const [createKind, setCreateKind] = useState<'file' | 'folder' | null>(null);
	const [createName, setCreateName] = useState('');
	const [trashFile, setTrashFile] = useState<DriveFile | null>(null);
	const selected = files.find((file) => file.id === selectedId) ?? null;
	const folders = files.filter((file) => file.mimeType === 'application/vnd.google-apps.folder');

	const refresh = useCallback(
		async (search = query, meet = meetOnly): Promise<void> => {
			setLoading(true);
			setError('');
			try {
				const next = await window.drive.list(search.trim() || undefined, meet);
				setFiles(next);
				setSelectedId((id) => (next.some((file) => file.id === id) ? id : null));
			} catch (caught) {
				setError(caught instanceof Error ? caught.message : String(caught));
			} finally {
				setLoading(false);
			}
		},
		[query, meetOnly]
	);

	useEffect(() => {
		let active = true;
		void window.drive
			.status()
			.then((value) => {
				if (!active) return;
				setConnected(value);
				if (value) {
					setLoading(true);
					void window.drive
						.list()
						.then((next) => {
							if (active) setFiles(next);
						})
						.catch((caught: unknown) => {
							if (active) setError(caught instanceof Error ? caught.message : String(caught));
						})
						.finally(() => {
							if (active) setLoading(false);
						});
				}
			})
			.catch((caught: unknown) => {
				if (active) {
					setConnected(false);
					setError(caught instanceof Error ? caught.message : String(caught));
				}
			});
		return () => {
			active = false;
		};
	}, []);

	const connect = async (): Promise<void> => {
		setBusy(true);
		setError('');
		try {
			await window.drive.connect();
			setConnected(true);
			await refresh('', false);
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : String(caught));
		} finally {
			setBusy(false);
		}
	};

	const update = async (id: string, input: DriveUpdateInput): Promise<void> => {
		setBusy(true);
		try {
			const updated = await window.drive.update(id, input);
			setFiles((current) => current.map((file) => (file.id === id ? updated : file)));
		} finally {
			setBusy(false);
		}
	};

	const create = async (): Promise<void> => {
		if (!createKind || !createName.trim()) return;
		setBusy(true);
		setError('');
		try {
			const created = await window.drive.create({
				name: createName.trim(),
				...(createKind === 'folder'
					? { mimeType: 'application/vnd.google-apps.folder' }
					: { mimeType: 'text/plain', content: '' }),
				...(selected?.mimeType === 'application/vnd.google-apps.folder'
					? { parentId: selected.id }
					: {}),
			});
			setCreateKind(null);
			setCreateName('');
			await refresh();
			setSelectedId(created.id);
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : String(caught));
		} finally {
			setBusy(false);
		}
	};

	const trash = async (): Promise<void> => {
		if (!trashFile) return;
		setBusy(true);
		setError('');
		try {
			await window.drive.trash(trashFile.id);
			setTrashFile(null);
			await refresh();
			setMessage('Moved to Drive trash.');
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : String(caught));
		} finally {
			setBusy(false);
		}
	};

	const download = async (file: DriveFile): Promise<void> => {
		setBusy(true);
		setError('');
		try {
			const path = await window.drive.download(file.id);
			if (path) setMessage(`Saved to ${path}`);
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : String(caught));
		} finally {
			setBusy(false);
		}
	};

	const chooseFolder = async (): Promise<void> => {
		try {
			const path = await window.drive.chooseFolder();
			if (path) setFolderPath(path);
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : String(caught));
		}
	};

	const backup = async (): Promise<void> => {
		if (!folderPath) return;
		setBusy(true);
		setError('');
		setMessage('');
		try {
			const result = await window.drive.sync(folderPath);
			setMessage(
				`Backup complete: ${result.uploaded} uploaded, ${result.skipped} skipped, ${result.failed} failed.`
			);
			await refresh();
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : String(caught));
		} finally {
			setBusy(false);
		}
	};

	return (
		<PageContainer className="overflow-hidden text-foreground">
			<Split
				sidebar={
					<div className="flex h-full min-h-0 flex-col">
						<header className="border-b border-sidebar-border/50 p-2">
							<Button
								type="button"
								variant="ghost"
								size="sm"
								className="w-full justify-start"
								onClick={() => navigate('/home')}
							>
								<ArrowLeft className="size-4" />
								Chat
							</Button>
						</header>
						<div className="flex items-center justify-between gap-1 px-3 py-3">
							<h1 className="text-sm font-medium">Google Drive</h1>
							<Button
								type="button"
								variant="ghost"
								size="icon-sm"
								aria-label="Refresh Drive files"
								disabled={!connected || loading}
								onClick={() => void refresh()}
							>
								<RefreshCw className="size-4" />
							</Button>
						</div>
						{connected ? (
							<>
								<form
									className="flex gap-1 px-2"
									onSubmit={(event) => {
										event.preventDefault();
										void refresh();
									}}
								>
									<Input
										aria-label="Search Drive"
										value={query}
										onChange={(event) => setQuery(event.target.value)}
										placeholder="Search files"
										className="h-8"
									/>
									<Button type="submit" size="icon-sm" variant="ghost" aria-label="Search">
										<Search className="size-4" />
									</Button>
								</form>
								<div className="flex gap-1 p-2">
									<Button
										type="button"
										size="sm"
										variant={!meetOnly ? 'secondary' : 'ghost'}
										onClick={() => {
											setMeetOnly(false);
											void refresh(query, false);
										}}
									>
										All files
									</Button>
									<Button
										type="button"
										size="sm"
										variant={meetOnly ? 'secondary' : 'ghost'}
										onClick={() => {
											setMeetOnly(true);
											void refresh(query, true);
										}}
									>
										Meet Recordings folder
									</Button>
								</div>
								<DriveFiles
									files={files}
									selectedId={selectedId}
									loading={loading}
									onSelect={(file) => setSelectedId(file.id)}
								/>
								<div className="grid grid-cols-2 gap-2 border-t p-2">
									<Button
										type="button"
										size="sm"
										variant="outline"
										onClick={() => setCreateKind('file')}
									>
										<Plus className="size-4" />
										File
									</Button>
									<Button
										type="button"
										size="sm"
										variant="outline"
										onClick={() => setCreateKind('folder')}
									>
										<Plus className="size-4" />
										Folder
									</Button>
								</div>
							</>
						) : null}
					</div>
				}
				sidebarLabel="Drive files"
			>
				{connected === null ? (
					<div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
						Checking Drive connection…
					</div>
				) : connected === false ? (
					<div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
						<h2 className="text-lg font-medium">Connect Google Drive</h2>
						<p className="text-sm text-muted-foreground">
							Browse and manage Drive files, access Meet recordings, and back up a local folder.
						</p>
						<Button type="button" disabled={busy} onClick={() => void connect()}>
							Connect Google Drive
						</Button>
						<Button
							type="button"
							variant="ghost"
							size="sm"
							onClick={() => navigate('/settings/mcp/google-drive')}
						>
							Connection settings
						</Button>
					</div>
				) : (
					<>
						<div className="flex flex-wrap items-center gap-2 border-b px-5 py-3">
							<CloudUpload className="size-4 text-muted-foreground" />
							<span className="text-sm font-medium">Manual folder backup</span>
							<span
								className="min-w-0 flex-1 truncate text-xs text-muted-foreground"
								title={folderPath}
							>
								{folderPath || 'Choose a local folder to upload to Drive.'}
							</span>
							<Button
								type="button"
								variant="outline"
								size="sm"
								disabled={busy}
								onClick={() => void chooseFolder()}
							>
								<FolderOpen className="size-4" />
								Choose folder
							</Button>
							<Button
								type="button"
								size="sm"
								disabled={busy || !folderPath}
								onClick={() => void backup()}
							>
								<CloudUpload className="size-4" />
								Back up now
							</Button>
						</div>
						{error ? (
							<p role="alert" className="border-b px-5 py-2 text-sm text-destructive">
								{error}
							</p>
						) : null}
						{message ? (
							<p role="status" className="border-b px-5 py-2 text-sm text-muted-foreground">
								{message}
							</p>
						) : null}
						<DriveInspector
							file={selected}
							folders={folders}
							busy={busy}
							onUpdate={update}
							onTrash={setTrashFile}
							onDownload={(file) => void download(file)}
						/>
					</>
				)}
			</Split>
			<Dialog
				open={createKind !== null}
				onOpenChange={(open) => {
					if (!open && !busy) {
						setCreateKind(null);
						setCreateName('');
					}
				}}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>New {createKind}</DialogTitle>
						<DialogDescription>
							{selected?.mimeType === 'application/vnd.google-apps.folder'
								? `Create in ${selected.name}.`
								: 'Create in My Drive.'}
						</DialogDescription>
					</DialogHeader>
					<form
						className="grid gap-4"
						onSubmit={(event) => {
							event.preventDefault();
							void create();
						}}
					>
						<Input
							autoFocus
							aria-label="Name"
							value={createName}
							onChange={(event) => setCreateName(event.target.value)}
						/>
						<DialogFooter>
							<Button
								type="button"
								variant="outline"
								disabled={busy}
								onClick={() => setCreateKind(null)}
							>
								Cancel
							</Button>
							<Button type="submit" disabled={busy || !createName.trim()}>
								Create
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>
			<Dialog
				open={trashFile !== null}
				onOpenChange={(open) => {
					if (!open && !busy) setTrashFile(null);
				}}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Move to trash?</DialogTitle>
						<DialogDescription>
							{trashFile?.name} will be moved to Google Drive trash.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							disabled={busy}
							onClick={() => setTrashFile(null)}
						>
							Cancel
						</Button>
						<Button
							type="button"
							variant="destructive"
							disabled={busy}
							onClick={() => void trash()}
						>
							Move to trash
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</PageContainer>
	);
}
