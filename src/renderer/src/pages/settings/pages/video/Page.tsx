import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, LoaderCircle, Sparkles } from 'lucide-react';
import { VideoPlayer } from '@/components/video-player';
import { providerIdsFor, providerModels } from '@/lib/providers';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
	type ModelProviderGroup,
	ModelProviderSelect,
} from '@/components/model-provider-select';
import {
	SettingsField,
	SettingsNotice,
	SettingsPageHeader,
	SettingsPageShell,
	SettingsPanel,
	SettingsSection,
} from '../../components';

function videoProviderGroups(): readonly ModelProviderGroup[] {
	return providerIdsFor('text-to-video').map((id) => ({
		id,
		models: providerModels(id, 'text-to-video'),
	}));
}

const VideoPage: React.FC = () => {
	const { t } = useTranslation();
	const [providerId, setProviderId] = useState('');
	const [modelId, setModelId] = useState('');
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [saved, setSaved] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [prompt, setPrompt] = useState('');
	const [generating, setGenerating] = useState(false);
	const [videoSrc, setVideoSrc] = useState<string | null>(null);
	const [videoPath, setVideoPath] = useState<string | null>(null);

	useEffect(() => {
		let mounted = true;
		void (async () => {
			try {
				const [storedProviderId, storedModelId] = await Promise.all([
					window.models.video.getProviderId(),
					window.models.video.getModelId(),
				]);
				if (!mounted) return;
				const nextProviderId =
					storedProviderId &&
					videoProviderGroups().some((group) => group.id === storedProviderId)
						? storedProviderId
						: (videoProviderGroups()[0]?.id ?? '');
				const models =
					videoProviderGroups().find((group) => group.id === nextProviderId)?.models ?? [];
				setProviderId(nextProviderId);
				setModelId(
					storedModelId && models.some((model) => model.id === storedModelId)
						? storedModelId
						: (models[0]?.id ?? '')
				);
			} catch (err) {
				if (mounted) setError(err instanceof Error ? err.message : String(err));
			} finally {
				if (mounted) setLoading(false);
			}
		})();
		return () => {
			mounted = false;
		};
	}, []);

	const handleChange = async (nextProviderId: string, nextModelId: string): Promise<void> => {
		setProviderId(nextProviderId);
		setModelId(nextModelId);
		setSaving(true);
		setSaved(false);
		setError(null);
		try {
			await window.models.video.setProviderId(nextProviderId);
			await window.models.video.setModelId(nextModelId);
			setSaved(true);
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setSaving(false);
		}
	};

	const handleGenerate = async (): Promise<void> => {
		if (!prompt.trim() || !providerId || !modelId) return;
		setGenerating(true);
		setError(null);
		try {
			const result = await window.models.video.createVideo({ prompt, providerId, modelId });
			setVideoSrc(`data:${result.mimeType};base64,${result.base64}`);
			setVideoPath(result.path ?? null);
		} catch (err) {
			setError(
				err instanceof Error && err.message.trim()
					? err.message
					: t('settings.video.generateError')
			);
		} finally {
			setGenerating(false);
		}
	};

	return (
		<SettingsPageShell>
			<SettingsPageHeader
				title={t('settings.modelServices.videoCreatorName')}
				description={t('settings.modelServices.videoCreatorDescription')}
			/>

			{error && (
				<SettingsNotice variant="destructive" icon={AlertTriangle}>
					{error}
				</SettingsNotice>
			)}

			<SettingsSection title={t('settings.modelServices.configuration')}>
				<SettingsPanel>
					<div className="grid gap-3 px-4 py-4">
						<ModelProviderSelect
							idPrefix="video"
							providerGroups={videoProviderGroups()}
							providerId={providerId}
							modelId={modelId}
							onChange={(nextProviderId, nextModelId) =>
								void handleChange(nextProviderId, nextModelId)
							}
							disabled={loading || saving}
							labels={{ description: t('settings.modelServices.modelDescription') }}
						/>

						{saved && (
							<p className="text-[11px] leading-4 text-muted-foreground">
								{t('settings.modelServices.saved')}
							</p>
						)}
					</div>
				</SettingsPanel>
			</SettingsSection>

			<SettingsSection title={t('settings.video.prompt')}>
				<SettingsPanel>
					<div className="grid gap-3 px-4 py-4">
						<SettingsField
							id="video-prompt"
							label={t('settings.video.prompt')}
							description={t('settings.video.promptDescription')}
						>
							<Textarea
								id="video-prompt"
								value={prompt}
								placeholder={t('settings.video.promptPlaceholder')}
								disabled={generating}
								onChange={(event) => setPrompt(event.target.value)}
							/>
						</SettingsField>

						<div className="flex justify-end">
							<Button
								type="button"
								size="sm"
								disabled={generating || loading || !prompt.trim() || !providerId || !modelId}
								onClick={() => void handleGenerate()}
							>
								{generating ? (
									<LoaderCircle className="size-3 animate-spin" />
								) : (
									<Sparkles className="size-3" />
								)}
								{generating ? t('settings.video.generating') : t('settings.video.generate')}
							</Button>
						</div>

						{videoSrc && (
							<div
								onContextMenu={
									videoPath
										? () => void window.app.showVideoContextMenu(videoPath)
										: undefined
								}
							>
								<VideoPlayer src={videoSrc} controls />
							</div>
						)}
					</div>
				</SettingsPanel>
			</SettingsSection>
		</SettingsPageShell>
	);
};

export default VideoPage;
