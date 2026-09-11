import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { app, isKucedr, win } from '@kucedr/sdk';
import type { CallbackListener, PlayerRef } from '@remotion/player';

import { Export } from './components/Export';
import { Header } from './components/Header';
import { Inspector } from './components/Inspector';
import { Media } from './components/Media';
import { Preview } from './components/Preview';
import { Status } from './components/Status';
import { Timeline } from './components/Timeline';
import { defaultProject } from './defaults';
import { downloadVideo } from './download';
import { getProjectDuration } from './duration';
import { makeId } from './id';
import { getFileKind } from './kind';
import { loadProject } from './load';
import { readMediaDuration } from './metadata';
import { saveProject } from './save';
import { storeMedia } from './store';
import { useKucedrTheme } from './theme';
import type { Clip, Project } from './types';

export default function App() {
	useKucedrTheme();
	const playerRef = useRef<PlayerRef>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const abortRef = useRef<AbortController | null>(null);
	const saveRevisionRef = useRef(0);
	const [project, setProject] = useState<Project>(defaultProject);
	const [selectedId, setSelectedId] = useState<string | null>(defaultProject.clips[0]?.id ?? null);
	const [currentFrame, setCurrentFrame] = useState(0);
	const [hydrated, setHydrated] = useState(false);
	const [canSave, setCanSave] = useState(false);
	const [saveStatus, setSaveStatus] = useState<'loading' | 'saving' | 'saved' | 'error'>('loading');
	const [notice, setNotice] = useState('');
	const [exporting, setExporting] = useState(false);
	const [exportProgress, setExportProgress] = useState(0);
	const [exportError, setExportError] = useState('');
	const duration = getProjectDuration(project);
	const inputProps = useMemo(() => ({ project }), [project]);
	const selectedClip = project.clips.find((clip) => clip.id === selectedId) ?? null;

	useEffect(() => {
		if (!isKucedr()) return;
		win.setTitlebarOptions({ title: 'Video Maker', leftButtons: [], rightButtons: [] });
		return () => win.setTitlebarOptions(null);
	}, []);

	useEffect(() => {
		let active = true;
		loadProject()
			.then((loaded) => {
				if (!active) return;
				setProject(loaded);
				setSelectedId(loaded.clips[0]?.id ?? null);
				setCanSave(true);
				setSaveStatus('saved');
				if (loaded.clips.some((clip) => !clip.available)) {
					setNotice(
						'Some saved media is unavailable. Its layers were kept so the project can recover.'
					);
				}
			})
			.catch((reason) => {
				if (!active) return;
				setNotice(reason instanceof Error ? reason.message : 'Could not open the saved project.');
				setSaveStatus('error');
			})
			.finally(() => active && setHydrated(true));
		return () => {
			active = false;
		};
	}, []);

	useEffect(() => {
		if (!hydrated || !canSave) return;
		const revision = ++saveRevisionRef.current;
		const timeout = window.setTimeout(() => {
			setSaveStatus('saving');
			saveProject(project)
				.then(() => {
					if (saveRevisionRef.current === revision) setSaveStatus('saved');
				})
				.catch(() => {
					if (saveRevisionRef.current === revision) setSaveStatus('error');
				});
		}, 450);
		return () => window.clearTimeout(timeout);
	}, [canSave, hydrated, project]);

	useEffect(() => {
		if (!canSave) return;
		const flush = () => void saveProject(project);
		window.addEventListener('pagehide', flush);
		return () => window.removeEventListener('pagehide', flush);
	}, [canSave, project]);

	useEffect(() => {
		const player = playerRef.current;
		if (!player || !hydrated) return;
		const update: CallbackListener<'timeupdate'> = (event) => setCurrentFrame(event.detail.frame);
		const seeked: CallbackListener<'seeked'> = (event) => setCurrentFrame(event.detail.frame);
		player.addEventListener('timeupdate', update);
		player.addEventListener('seeked', seeked);
		return () => {
			player.removeEventListener('timeupdate', update);
			player.removeEventListener('seeked', seeked);
		};
	}, [hydrated]);

	useEffect(() => {
		const finalFrame = Math.max(0, Math.ceil(duration * project.fps) - 1);
		if (currentFrame <= finalFrame) return;
		playerRef.current?.seekTo(finalFrame);
	}, [currentFrame, duration, project.fps]);

	const updateProject = useCallback((patch: Partial<Project>) => {
		setProject((current) => ({ ...current, ...patch }));
	}, []);

	const updateClip = useCallback(
		(patch: Partial<Clip>) => {
			if (!selectedId) return;
			setProject((current) => ({
				...current,
				clips: current.clips.map((clip) => (clip.id === selectedId ? { ...clip, ...patch } : clip)),
			}));
		},
		[selectedId]
	);

	const addText = useCallback(() => {
		const id = makeId();
		const start = currentFrame / project.fps;
		const clip: Clip = {
			id,
			kind: 'text',
			name: 'Text layer',
			src: '',
			assetPath: null,
			mime: null,
			available: true,
			start,
			duration: 3,
			sourceDuration: null,
			text: 'New text',
			color: '#f8fafc',
			fontSize: 96,
			volume: 1,
			muted: false,
			fit: 'cover',
		};
		setProject((current) => ({ ...current, clips: [...current.clips, clip] }));
		setSelectedId(id);
	}, [currentFrame, project.fps]);

	const importFiles = useCallback(
		async (files: File[]) => {
			const supported = files.filter((file) => getFileKind(file));
			if (supported.length === 0) {
				setNotice('Choose a video, image, or audio file.');
				return;
			}
			setNotice('Importing media…');
			let cursor = getProjectDuration(project);
			const clips: Clip[] = [];
			for (const file of supported) {
				const kind = getFileKind(file);
				if (!kind) continue;
				const id = makeId();
				const src = URL.createObjectURL(file);
				try {
					const sourceDuration = await readMediaDuration(file);
					const assetPath = await storeMedia(id, file);
					clips.push({
						id,
						kind,
						name: file.name,
						src,
						assetPath,
						mime: file.type,
						available: true,
						start: cursor,
						duration: sourceDuration,
						sourceDuration,
						text: '',
						color: '#f8fafc',
						fontSize: 96,
						volume: 1,
						muted: false,
						fit: 'cover',
					});
					cursor += sourceDuration;
				} catch (reason) {
					URL.revokeObjectURL(src);
					setNotice(reason instanceof Error ? reason.message : `Could not import ${file.name}.`);
				}
			}
			if (clips.length > 0) {
				setProject((current) => ({ ...current, clips: [...current.clips, ...clips] }));
				setSelectedId(clips[0].id);
				setNotice(`${clips.length} ${clips.length === 1 ? 'asset' : 'assets'} imported.`);
			}
		},
		[project]
	);

	const removeSelected = useCallback(() => {
		if (!selectedClip) return;
		if (selectedClip.src.startsWith('blob:')) URL.revokeObjectURL(selectedClip.src);
		setProject((current) => ({
			...current,
			clips: current.clips.filter((clip) => clip.id !== selectedClip.id),
		}));
		setSelectedId(project.clips.find((clip) => clip.id !== selectedClip.id)?.id ?? null);
	}, [project.clips, selectedClip]);

	const seek = useCallback(
		(seconds: number) => {
			const frame = Math.max(
				0,
				Math.min(Math.ceil(duration * project.fps) - 1, Math.round(seconds * project.fps))
			);
			playerRef.current?.seekTo(frame);
			setCurrentFrame(frame);
		},
		[duration, project.fps]
	);

	const openDocs = useCallback(() => {
		const url = 'https://www.remotion.dev/docs/';
		if (isKucedr()) void app.openExternalUrl(url);
		else window.open(url, '_blank', 'noopener,noreferrer');
	}, []);

	const startExport = useCallback(async () => {
		setExporting(true);
		setExportProgress(0);
		setExportError('');
		const controller = new AbortController();
		abortRef.current = controller;
		try {
			const { renderProject } = await import('./render');
			const blob = await renderProject(project, setExportProgress, controller.signal);
			downloadVideo(blob, project.name);
			setExporting(false);
			setNotice('MP4 export complete.');
		} catch (reason) {
			if (controller.signal.aborted) {
				setExporting(false);
				setNotice('Export cancelled.');
			} else {
				setExportError(
					reason instanceof Error ? reason.message : 'The video could not be rendered.'
				);
			}
		} finally {
			abortRef.current = null;
		}
	}, [project]);

	const cancelExport = useCallback(() => abortRef.current?.abort(), []);
	const closeExport = useCallback(() => {
		setExportError('');
		setExporting(false);
	}, []);

	return (
		<main className="videomaker">
			<Header
				project={project}
				exporting={exporting}
				onName={(name) => updateProject({ name })}
				onPreset={(width, height) => updateProject({ width, height })}
				onImport={() => fileInputRef.current?.click()}
				onAddText={addText}
				onDocs={openDocs}
				onExport={() => void startExport()}
			/>
			<input
				ref={fileInputRef}
				className="visually-hidden"
				type="file"
				accept="video/*,image/*,audio/*"
				multiple
				onChange={(event) => {
					void importFiles(Array.from(event.target.files ?? []));
					event.target.value = '';
				}}
			/>
			{notice ? (
				<div className="notice" role="status">
					<span>{notice}</span>
					<button
						className="icon-button"
						onClick={() => setNotice('')}
						aria-label="Dismiss message"
					>
						×
					</button>
				</div>
			) : null}
			<div className="editor-body">
				<div className="workspace">
					<Media
						clips={project.clips}
						selectedId={selectedId}
						onSelect={setSelectedId}
						onImport={() => fileInputRef.current?.click()}
						onFiles={(files) => void importFiles(files)}
					/>
					<Preview inputProps={inputProps} playerRef={playerRef} />
					<Inspector
						project={project}
						clip={selectedClip}
						onProject={updateProject}
						onClip={updateClip}
						onRemove={removeSelected}
					/>
				</div>
				<Timeline
					project={project}
					duration={duration}
					currentTime={currentFrame / project.fps}
					selectedId={selectedId}
					onSelect={setSelectedId}
					onSeek={seek}
				/>
			</div>
			<Status
				status={saveStatus}
				dimensions={`${project.width}×${project.height}`}
				fps={project.fps}
			/>
			{exporting || exportError ? (
				<Export
					progress={exportProgress}
					error={exportError}
					onCancel={cancelExport}
					onClose={closeExport}
				/>
			) : null}
		</main>
	);
}
