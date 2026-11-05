import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { PromptInputVoiceMode } from '@/components/ui/prompt-input';
import type { ChatMode } from '@/contexts/chat-mode';
import { appendTranscriptionText, fileToSttAudioInput } from './stt';
import { useAudioRecorder } from './useAudioRecorder';
import { useRealtimeDictation } from './useRealtimeDictation';
import { useVoiceButtonMode, type VoiceButtonMode } from './useVoiceButtonMode';

export function usePromptVoice({
	value,
	onValueChange,
	isLoading,
	mode,
	setMode,
}: {
	readonly value: string;
	readonly onValueChange: (value: string) => void;
	readonly isLoading: boolean;
	readonly mode: ChatMode;
	readonly setMode: (mode: ChatMode) => void;
}) {
	const navigate = useNavigate();
	const [voiceMode, setVoiceMode] = useState<PromptInputVoiceMode | null>(null);
	const [activeDictationMode, setActiveDictationMode] = useState<VoiceButtonMode | null>(null);
	const dictation = useRealtimeDictation({ value, onValueChange });
	const recorder = useAudioRecorder();
	const buttonMode = useVoiceButtonMode();
	const [transcriptionErrorMessage, setTranscriptionErrorMessage] = useState<string | null>(null);
	const [transcribingRecording, setTranscribingRecording] = useState(false);
	const transcriptionRunRef = useRef(0);
	const dictationStatus = dictation.status;
	const cancelDictationSession = dictation.cancel;
	const recorderStatus = recorder.status;
	const cancelRecordingSession = recorder.cancel;
	const dictationBusy =
		dictationStatus === 'checking-permission' ||
		dictationStatus === 'connecting' ||
		dictationStatus === 'finishing';
	const recordingBusy =
		recorderStatus === 'checking-permission' ||
		recorderStatus === 'stopping' ||
		transcribingRecording;
	const busy = dictationBusy || recordingBusy;
	const recording = activeDictationMode === 'record';
	const errorMessage =
		transcriptionErrorMessage ?? recorder.errorMessage ?? dictation.errorMessage;
	const errorAction = errorMessage?.toLowerCase().includes('microphone')
		? {
				label: 'Open Microphone settings',
				action: () => navigate('/settings/settings/media/microphone'),
			}
		: undefined;
	const disabledReason =
		buttonMode === 'disabled'
			? 'Choose a speech-to-text provider and model in Settings.'
			: busy
				? 'Wait for the current voice operation to finish.'
				: isLoading
					? 'Wait for the current response to finish.'
					: undefined;

	useEffect(() => {
		if (mode !== 'chat') return;
		setActiveDictationMode(null);
		setVoiceMode(null);
	}, [mode]);

	useEffect(() => {
		if (mode !== 'chat') return;
		if (
			dictationStatus === 'checking-permission' ||
			dictationStatus === 'connecting' ||
			dictationStatus === 'recording'
		) {
			void cancelDictationSession();
		}
		if (
			recorderStatus === 'checking-permission' ||
			recorderStatus === 'recording' ||
			recorderStatus === 'stopping'
		) {
			void cancelRecordingSession();
		}
	}, [cancelDictationSession, cancelRecordingSession, dictationStatus, mode, recorderStatus]);

	const start = async (): Promise<void> => {
		setTranscriptionErrorMessage(null);
		if (buttonMode === 'disabled') {
			setTranscriptionErrorMessage('Choose a speech-to-text provider and model in Settings.');
			return;
		}
		if (buttonMode === 'record') {
			const started = await recorder.start();
			if (!started) {
				setMode('chat');
				return;
			}
			setActiveDictationMode('record');
			setVoiceMode('dictation');
			setMode('voice');
			return;
		}

		const started = await dictation.start();
		if (!started) {
			setMode('chat');
			return;
		}
		setActiveDictationMode('dictate');
		setVoiceMode('dictation');
		setMode('voice');
	};

	const cancel = async (): Promise<void> => {
		transcriptionRunRef.current += 1;
		setTranscribingRecording(false);
		if (recording) {
			await recorder.cancel();
		} else {
			await dictation.cancel();
		}
		setMode('chat');
	};

	const confirm = async (): Promise<void> => {
		if (recording) {
			const runId = transcriptionRunRef.current + 1;
			transcriptionRunRef.current = runId;
			setTranscribingRecording(true);
			setTranscriptionErrorMessage(null);

			try {
				const audio = await recorder.stop();
				if (!audio) {
					setMode('chat');
					return;
				}

				try {
					const result = await window.models.transcribe.transcribe({
						audio: await fileToSttAudioInput(audio.file),
					});
					if (transcriptionRunRef.current === runId) {
						onValueChange(appendTranscriptionText(value, result.text));
					}
				} finally {
					if (audio.url) URL.revokeObjectURL(audio.url);
				}
			} catch (error) {
				const message =
					error instanceof Error && error.message.trim()
						? error.message
						: 'Speech transcription failed.';
				if (transcriptionRunRef.current === runId) setTranscriptionErrorMessage(message);
			} finally {
				if (transcriptionRunRef.current === runId) {
					setTranscribingRecording(false);
					setMode('chat');
				}
			}
			return;
		}

		await dictation.finish();
		setMode('chat');
	};

	return {
		voiceMode,
		buttonMode,
		busy,
		disabledReason,
		errorMessage,
		errorAction,
		elapsedMs: recording ? recorder.elapsedMs : dictation.elapsedMs,
		muted: recording ? recorder.isMuted : dictation.isMuted,
		stream: recording ? recorder.stream : dictation.stream,
		setMuted: recording ? recorder.setMuted : dictation.setMuted,
		status: recording ? 'Recording' : 'Listening',
		start,
		cancel,
		confirm,
	};
}
