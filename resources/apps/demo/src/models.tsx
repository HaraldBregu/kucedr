import { useEffect, useState } from 'react';
import { isKucedr, models, type AppLanguage } from '@kucedr/sdk';

import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Textarea } from './components/ui/textarea';
import { fileToBase64 } from './file';
import translations from './i18n.json';

interface ModelsProps {
	language: AppLanguage;
	ensureKucedr: () => boolean;
}

export function Models({ language, ensureKucedr }: ModelsProps) {
	const text = translations[language] ?? translations.en;
	const [prompt, setPrompt] = useState('Describe a calm workspace in one sentence.');
	const [audioFile, setAudioFile] = useState<File>();
	const [result, setResult] = useState('');
	const [mediaUrl, setMediaUrl] = useState('');
	const [mediaType, setMediaType] = useState<'image' | 'audio' | 'video'>();
	const [busy, setBusy] = useState(false);
	const [chatSessionId, setChatSessionId] = useState('');
	const [realtimeSessionId, setRealtimeSessionId] = useState('');

	useEffect(() => {
		if (!isKucedr()) return;
		return models.realtimeVoice.onSessionEvent((event) => {
			if ('sessionId' in event && event.sessionId !== realtimeSessionId) return;
			setResult(JSON.stringify(event, null, 2));
			if (event.type === 'closed') setRealtimeSessionId('');
		});
	}, [realtimeSessionId]);

	const run = async (action: () => Promise<string>) => {
		if (!ensureKucedr()) return;
		setBusy(true);
		setMediaUrl('');
		setMediaType(undefined);
		try {
			setResult(await action());
		} catch (error) {
			setResult(error instanceof Error ? error.message : String(error));
		} finally {
			setBusy(false);
		}
	};

	const showMedia = (kind: 'image' | 'audio' | 'video', base64: string, mimeType: string) => {
		setMediaType(kind);
		setMediaUrl(`data:${mimeType};base64,${base64}`);
		return `${kind}: ${mimeType}`;
	};

	return (
		<div id="models" className="space-y-4 border-t border-border pt-4">
			<div>
				<p className="text-sm font-semibold">{text.models}</p>
				<p className="mt-1 text-sm text-muted-foreground">{text.modelsDescription}</p>
			</div>
			<label className="block space-y-1 text-sm" htmlFor="model-prompt">
				<span>{text.modelPrompt}</span>
				<Textarea
					id="model-prompt"
					value={prompt}
					disabled={busy}
					onChange={(event) => setPrompt(event.target.value)}
				/>
			</label>
			<div className="flex flex-wrap gap-2">
				<Button
					size="sm"
					disabled={busy}
					onClick={() => run(() => models.text.generateText({ prompt }))}
				>
					{text.runLlm}
				</Button>
				<Button
					size="sm"
					variant="outline"
					disabled={busy}
					onClick={() =>
						run(async () => {
							const value = await models.embedding.createEmbedding({ texts: [prompt] });
							return JSON.stringify(
								{ ...value, embeddings: value.embeddings.map((item) => item.slice(0, 8)) },
								null,
								2
							);
						})
					}
				>
					{text.runEmbedding}
				</Button>
				<Button
					size="sm"
					variant="outline"
					disabled={busy}
					onClick={() =>
						run(async () => {
							const value = await models.voice.synthesize({ text: prompt });
							return showMedia('audio', value.audio, value.mimeType);
						})
					}
				>
					{text.runTts}
				</Button>
				<Button
					size="sm"
					variant="outline"
					disabled={busy}
					onClick={() =>
						run(async () => {
							const value = await models.image.createImage({ prompt });
							return showMedia('image', value.base64, value.mimeType);
						})
					}
				>
					{text.runImage}
				</Button>
				<Button
					size="sm"
					variant="outline"
					disabled={busy}
					onClick={() =>
						run(async () => {
							const value = await models.sound.createSound({ prompt });
							return showMedia('audio', value.base64, value.mimeType);
						})
					}
				>
					{text.runSound}
				</Button>
				<Button
					size="sm"
					variant="outline"
					disabled={busy}
					onClick={() =>
						run(async () => {
							const value = await models.video.createVideo({ prompt });
							return showMedia('video', value.base64, value.mimeType);
						})
					}
				>
					{text.runVideo}
				</Button>
				<Button
					size="sm"
					variant="secondary"
					disabled={busy}
					onClick={() =>
						run(async () => JSON.stringify(await models.realtimeVoice.getSetup(), null, 2))
					}
				>
					{text.getRealtimeVoice}
				</Button>
			</div>
			<div className="space-y-2 rounded-md border border-border p-4">
				<label className="block space-y-1 text-sm" htmlFor="stt-audio">
					<span>{text.sttAudio}</span>
					<Input
						id="stt-audio"
						type="file"
						accept="audio/*"
						disabled={busy}
						onChange={(event) => setAudioFile(event.target.files?.[0])}
					/>
				</label>
				<Button
					size="sm"
					disabled={busy || !audioFile}
					onClick={() =>
						run(async () => {
							if (!audioFile) throw new Error(text.sttAudioRequired);
							const value = await models.transcribe.transcribe({
								audio: {
									data: await fileToBase64(audioFile),
									encoding: 'base64',
									mimeType: audioFile.type || 'application/octet-stream',
									fileName: audioFile.name,
									byteLength: audioFile.size,
								},
							});
							return value.text;
						})
					}
				>
					{text.runStt}
				</Button>
			</div>
			<div className="space-y-2 rounded-md border border-border p-4">
				<label className="block space-y-1 text-sm" htmlFor="realtime-chat-session">
					<span>{text.realtimeChatSession}</span>
					<Input
						id="realtime-chat-session"
						value={chatSessionId}
						disabled={busy || Boolean(realtimeSessionId)}
						onChange={(event) => setChatSessionId(event.target.value)}
					/>
				</label>
				<div className="flex flex-wrap gap-2">
					<Button
						size="sm"
						disabled={busy || Boolean(realtimeSessionId) || !chatSessionId.trim()}
						onClick={() =>
							run(async () => {
								const session = await models.realtimeVoice.startSession({ chatSessionId });
								setRealtimeSessionId(session.id);
								return JSON.stringify(session, null, 2);
							})
						}
					>
						{text.startRealtimeVoice}
					</Button>
					<Button
						size="sm"
						variant="destructive"
						disabled={busy || !realtimeSessionId}
						onClick={() =>
							run(async () => {
								await models.realtimeVoice.stopSession(realtimeSessionId);
								setRealtimeSessionId('');
								return text.realtimeVoiceStopped;
							})
						}
					>
						{text.stopRealtimeVoice}
					</Button>
				</div>
			</div>
			<pre className="max-h-48 min-h-12 overflow-auto whitespace-pre-wrap break-words rounded-md bg-muted p-3 text-xs">
				{result || text.modelResultEmpty}
			</pre>
			{mediaType === 'image' && mediaUrl ? (
				<img src={mediaUrl} alt={text.generatedImage} className="max-h-72 rounded-md" />
			) : null}
			{mediaType === 'audio' && mediaUrl ? (
				<audio src={mediaUrl} controls className="w-full" />
			) : null}
			{mediaType === 'video' && mediaUrl ? (
				<video src={mediaUrl} controls className="max-h-72 w-full rounded-md" />
			) : null}
		</div>
	);
}
