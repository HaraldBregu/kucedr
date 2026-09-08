import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, LoaderCircle, Mic, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAudioRecorder, useRealtimeDictation } from '@/pages/home/hooks';
import { fileToSttAudioInput } from '@/pages/home/hooks/stt';
import { SettingsNotice, SettingsPanel } from '../../components';

interface ExamplePanelProps {
	readonly title: React.ReactNode;
	readonly hint: React.ReactNode;
	readonly error?: string | null;
	readonly transcript?: string | null;
	readonly emptyText?: React.ReactNode;
	readonly action: React.ReactNode;
}

function ExamplePanel({
	title,
	hint,
	error,
	transcript,
	emptyText,
	action,
}: ExamplePanelProps): React.JSX.Element {
	return (
		<SettingsPanel>
			<div className="grid gap-3 px-4 py-4">
				<div>
					<div className="text-[13px] font-medium leading-4 text-foreground">{title}</div>
					<p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">{hint}</p>
				</div>
				{error && (
					<SettingsNotice variant="destructive" icon={AlertTriangle}>
						{error}
					</SettingsNotice>
				)}
				{transcript != null && (
					<p className="rounded-md border border-border/70 bg-muted/40 px-2 py-1.5 text-xs text-foreground">
						{transcript.trim() || emptyText}
					</p>
				)}
				<div className="flex justify-end">{action}</div>
			</div>
		</SettingsPanel>
	);
}

const RealtimeExample: React.FC = () => {
	const { t } = useTranslation();
	const [transcript, setTranscript] = useState('');
	const dictation = useRealtimeDictation({ value: transcript, onValueChange: setTranscript });
	const isRecording = dictation.status === 'recording';
	const busy =
		dictation.status === 'checking-permission' ||
		dictation.status === 'connecting' ||
		dictation.status === 'finishing';

	const handleToggle = async (): Promise<void> => {
		if (isRecording) {
			await dictation.finish();
			return;
		}
		setTranscript('');
		await dictation.start();
	};

	return (
		<ExamplePanel
			title={t('settings.modelServices.realtimeConfiguration')}
			hint={t('settings.modelServices.testRealtimeHint')}
			error={dictation.errorMessage}
			transcript={isRecording || transcript ? transcript : null}
			emptyText={t('settings.modelServices.testRealtimeListening')}
			action={
				<Button
					type="button"
					size="sm"
					variant={isRecording ? 'destructive' : 'default'}
					disabled={busy || !dictation.isSupported}
					onClick={() => void handleToggle()}
				>
					{busy ? (
						<LoaderCircle className="size-3 animate-spin" />
					) : isRecording ? (
						<Square className="size-3" />
					) : (
						<Mic className="size-3" />
					)}
					{isRecording
						? t('settings.modelServices.testRealtimeStop')
						: t('settings.modelServices.testRealtimeStart')}
				</Button>
			}
		/>
	);
};

const RecordedExample: React.FC = () => {
	const { t } = useTranslation();
	const recorder = useAudioRecorder();
	const [transcribing, setTranscribing] = useState(false);
	const [transcript, setTranscript] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	const isRecording = recorder.status === 'recording';

	const handleToggle = async (): Promise<void> => {
		setError(null);
		if (!isRecording) {
			setTranscript(null);
			await recorder.start();
			return;
		}

		setTranscribing(true);
		try {
			const recording = await recorder.stop();
			if (!recording) return;
			try {
				const result = await window.models.transcribe.transcribe({
					audio: await fileToSttAudioInput(recording.file),
				});
				setTranscript(result.text);
			} finally {
				if (recording.url) URL.revokeObjectURL(recording.url);
			}
		} catch (err) {
			setError(
				err instanceof Error && err.message.trim()
					? err.message
					: t('settings.modelServices.testTranscribeError')
			);
		} finally {
			setTranscribing(false);
		}
	};

	return (
		<ExamplePanel
			title={t('settings.modelServices.transcribeConfiguration')}
			hint={t('settings.modelServices.testTranscribeHint')}
			error={error ?? recorder.errorMessage}
			transcript={transcript}
			emptyText={t('settings.modelServices.testTranscribeEmpty')}
			action={
				<Button
					type="button"
					size="sm"
					variant={isRecording ? 'destructive' : 'default'}
					disabled={transcribing || !recorder.isSupported}
					onClick={() => void handleToggle()}
				>
					{transcribing ? (
						<LoaderCircle className="size-3 animate-spin" />
					) : isRecording ? (
						<Square className="size-3" />
					) : (
						<Mic className="size-3" />
					)}
					{transcribing
						? t('settings.modelServices.testTranscribeTranscribing')
						: isRecording
							? t('settings.modelServices.testTranscribeStop')
							: t('settings.modelServices.testTranscribeRecord')}
				</Button>
			}
		/>
	);
};

const TranscribeTest: React.FC = () => {
	return (
		<div className="grid gap-2">
			<RealtimeExample />
			<RecordedExample />
		</div>
	);
};

export default TranscribeTest;
