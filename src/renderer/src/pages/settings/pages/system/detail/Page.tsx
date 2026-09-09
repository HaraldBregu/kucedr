import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useParams } from 'react-router-dom';
import { Play, RotateCcw, Settings, ShieldCheck, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { MicrophoneSystemPermissionStatus, SystemPreferencePaneId } from '@shared/app_types';
import {
	SettingsNotice,
	SettingsPageHeader,
	SettingsPageShell,
	SettingsPanel,
	SettingsSection,
} from '../../../components';
import { getSystemMedia, type SystemMedia } from './media';
import { useMediaRecorderTest } from './recorder';
import { MicrophoneInput } from './Input';

function errorMessage(error: unknown, fallback: string): string {
	return error instanceof Error ? error.message : fallback;
}

function formatElapsed(seconds: number): string {
	const minutes = Math.floor(seconds / 60);
	return `${minutes}:${(seconds % 60).toString().padStart(2, '0')}`;
}

function statusClassName(status: MicrophoneSystemPermissionStatus): string {
	switch (status) {
		case 'granted':
			return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300';
		case 'denied':
		case 'restricted':
			return 'border-destructive/30 bg-destructive/10 text-destructive';
		case 'not-determined':
			return 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300';
		default:
			return 'border-border bg-muted/40 text-muted-foreground';
	}
}

function MediaDetail({ media }: { readonly media: SystemMedia }): React.JSX.Element {
	const { t } = useTranslation();
	const {
		state: recorderState,
		error: recorderError,
		recordedUrl,
		elapsedSeconds,
		videoRef,
		start,
		stop,
		reset,
	} = useMediaRecorderTest(media);
	const [status, setStatus] = useState<MicrophoneSystemPermissionStatus>('unknown');
	const [permissionError, setPermissionError] = useState('');

	useEffect(() => {
		let active = true;
		const request = media.permission
			? media.permission === 'camera'
				? window.app.getCameraPermission()
				: window.app.getMicrophonePermission()
			: window.app.getScreenCapturePermission();
		void request
			.then((result) => {
				if (active) setStatus(result.systemStatus);
			})
			.catch((error) => {
				if (active) {
					setPermissionError(errorMessage(error, t(`settings.${media.permission}.errors.load`)));
				}
			});
		return () => {
			active = false;
		};
	}, [media.permission, t]);

	const handleRequest = useCallback(async (): Promise<void> => {
		if (!media.permission) return;
		setPermissionError('');
		try {
			const result =
				media.permission === 'camera'
					? await window.app.requestCameraPermission()
					: await window.app.requestMicrophonePermission();
			setStatus(result.systemStatus);
		} catch (error) {
			setPermissionError(errorMessage(error, t(`settings.${media.permission}.errors.request`)));
		}
	}, [media.permission, t]);

	const openSettings = useCallback(
		(pane: SystemPreferencePaneId): void => {
			setPermissionError('');
			void window.app.openSystemPreference(pane).catch((error: unknown) => {
				setPermissionError(errorMessage(error, t('settings.system.errors.openPreference')));
			});
		},
		[t]
	);

	return (
		<SettingsPageShell>
			<SettingsPageHeader title={t(media.titleKey)} description={t(media.descriptionKey)} />

			{media.id === 'microphone' && (
				<MicrophoneInput
					refreshKey={`${status}-${recorderState}`}
					disabled={recorderState === 'starting' || recorderState === 'recording'}
				/>
			)}

			{permissionError && <SettingsNotice variant="destructive">{permissionError}</SettingsNotice>}
			{!media.permission && (status === 'denied' || status === 'restricted') && (
				<SettingsNotice variant="destructive">
					{t('settings.system.media.screen.permissionHelp')}
				</SettingsNotice>
			)}

			<SettingsSection title={t('settings.system.mediaPermissions.title')}>
				<SettingsPanel>
					<div className="flex flex-wrap items-center gap-2 p-4">
						{media.permission ? (
							<>
								<span
									className={cn(
										'inline-flex h-6 items-center rounded-md border px-2 text-[11px] font-medium',
										statusClassName(status)
									)}
								>
									{t(`settings.system.permissionStatus.${status}`)}
								</span>
								<Button variant="outline" size="xs" onClick={() => void handleRequest()}>
									<ShieldCheck className="size-3" />
									{t('settings.camera.actions.request')}
								</Button>
								<Button
									variant="outline"
									size="xs"
									onClick={() =>
										openSettings(media.permission === 'camera' ? 'Camera' : 'Microphone')
									}
								>
									<Settings className="size-3" />
									{t('settings.camera.actions.openSettings')}
								</Button>
							</>
						) : (
							<>
								<span
									className={cn(
										'inline-flex h-6 items-center rounded-md border px-2 text-[11px] font-medium',
										statusClassName(status)
									)}
								>
									{t(`settings.system.permissionStatus.${status}`)}
								</span>
								<Button variant="outline" size="xs" onClick={() => openSettings('ScreenCapture')}>
									<Settings className="size-3" />
									{t('settings.application.openScreenRecording')}
								</Button>
							</>
						)}
					</div>
				</SettingsPanel>
			</SettingsSection>

			<SettingsSection
				title={t('settings.system.media.test.title')}
				description={t('settings.system.media.test.description')}
			>
				<SettingsPanel>
					<div className="flex flex-col gap-3 p-4">
						{recorderError && (
							<SettingsNotice variant="destructive">{recorderError}</SettingsNotice>
						)}

						{media.video && recorderState !== 'recorded' && (
							<video
								ref={videoRef}
								muted
								playsInline
								className="aspect-video w-full rounded-md bg-black/80"
							/>
						)}

						{!media.video && (
							<div className="flex h-24 items-center justify-center rounded-md border border-border/60 bg-muted/30 text-xs text-muted-foreground">
								{recorderState === 'recording'
									? t('settings.system.media.test.recording', {
											time: formatElapsed(elapsedSeconds),
										})
									: t('settings.system.media.test.audioIdle')}
							</div>
						)}

						<div className="flex flex-wrap items-center gap-2">
							{recorderState !== 'recording' ? (
								<Button
									size="xs"
									disabled={recorderState === 'starting'}
									onClick={() => void start()}
								>
									<Play className="size-3" />
									{t('settings.system.media.test.start')}
								</Button>
							) : (
								<Button size="xs" variant="destructive" onClick={stop}>
									<Square className="size-3" />
									{t('settings.system.media.test.stop')}
									{media.video ? ` · ${formatElapsed(elapsedSeconds)}` : ''}
								</Button>
							)}
							{recorderState === 'recorded' && (
								<Button size="xs" variant="outline" onClick={reset}>
									<RotateCcw className="size-3" />
									{t('settings.system.media.test.retry')}
								</Button>
							)}
						</div>

						{recorderState === 'recorded' && recordedUrl && (
							<div className="flex flex-col gap-1.5">
								<p className="text-[11px] font-medium text-muted-foreground">
									{t('settings.system.media.test.result')}
								</p>
								{media.video ? (
									<video
										src={recordedUrl}
										controls
										playsInline
										className="aspect-video w-full rounded-md bg-black/80"
									/>
								) : (
									<audio src={recordedUrl} controls className="w-full" />
								)}
							</div>
						)}
					</div>
				</SettingsPanel>
			</SettingsSection>
		</SettingsPageShell>
	);
}

const SystemMediaDetailPage: React.FC = () => {
	const { mediaId } = useParams<{ mediaId: string }>();
	const media = getSystemMedia(mediaId);
	if (!media) return <Navigate to="/settings/system" replace />;
	return <MediaDetail key={media.id} media={media} />;
};

export default SystemMediaDetailPage;
