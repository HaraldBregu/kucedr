import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, LoaderCircle, Music, Sparkles } from 'lucide-react';
import type { SoundFile } from '../../../../../../shared/sound_types';
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

function musicProviderGroups(): readonly ModelProviderGroup[] {
	return providerIdsFor('text-to-audio').map((id) => ({
		id,
		models: providerModels(id, 'text-to-audio'),
	}));
}

function localResourceUrl(filePath: string): string {
	const posixPath = filePath.replace(/\\/g, '/');
	const absolutePath = posixPath.startsWith('/') ? posixPath : `/${posixPath}`;
	return `local-resource://file${encodeURI(absolutePath)}`;
}

const MusicPage: React.FC = () => {
	const { t } = useTranslation();
	const [providerId, setProviderId] = useState('');
	const [modelId, setModelId] = useState('');
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [saved, setSaved] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [prompt, setPrompt] = useState('');
	const [generating, setGenerating] = useState(false);
	const [sounds, setSounds] = useState<SoundFile[]>([]);

	const refreshSounds = useCallback(async (): Promise<void> => {
		try {
			setSounds(await window.models.sound.listSounds());
		} catch {
			// Listing is best-effort; generation errors are surfaced separately.
		}
	}, []);

	useEffect(() => {
		let mounted = true;
		void (async () => {
			try {
				const [storedProviderId, storedModelId] = await Promise.all([
					window.models.sound.getProviderId(),
					window.models.sound.getModelId(),
				]);
				if (!mounted) return;
				const nextProviderId =
					storedProviderId &&
					musicProviderGroups().some((group) => group.id === storedProviderId)
						? storedProviderId
						: (musicProviderGroups()[0]?.id ?? '');
				const models =
					musicProviderGroups().find((group) => group.id === nextProviderId)?.models ?? [];
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
		void refreshSounds();
		return () => {
			mounted = false;
		};
	}, [refreshSounds]);

	const handleChange = async (nextProviderId: string, nextModelId: string): Promise<void> => {
		setProviderId(nextProviderId);
		setModelId(nextModelId);
		setSaving(true);
		setSaved(false);
		setError(null);
		try {
			await window.models.sound.setProviderId(nextProviderId);
			await window.models.sound.setModelId(nextModelId);
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
			await window.models.sound.createSound({ prompt, providerId, modelId });
			await refreshSounds();
		} catch (err) {
			setError(
				err instanceof Error && err.message.trim()
					? err.message
					: t('settings.music.generateError')
			);
		} finally {
			setGenerating(false);
		}
	};

	return (
		<SettingsPageShell>
			<SettingsPageHeader
				title={t('settings.modelServices.musicCreatorName')}
				description={t('settings.modelServices.musicCreatorDescription')}
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
							idPrefix="music"
							providerGroups={musicProviderGroups()}
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

			<SettingsSection title={t('settings.music.prompt')}>
				<SettingsPanel>
					<div className="grid gap-3 px-4 py-4">
						<SettingsField
							id="music-prompt"
							label={t('settings.music.prompt')}
							description={t('settings.music.promptDescription')}
						>
							<Textarea
								id="music-prompt"
								value={prompt}
								placeholder={t('settings.music.promptPlaceholder')}
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
								{generating ? t('settings.music.generating') : t('settings.music.generate')}
							</Button>
						</div>
					</div>
				</SettingsPanel>
			</SettingsSection>

			<SettingsSection title={t('settings.music.libraryTitle')}>
				<SettingsPanel>
					{sounds.length === 0 ? (
						<p className="px-4 py-4 text-[11px] leading-4 text-muted-foreground">
							{t('settings.music.libraryEmpty')}
						</p>
					) : (
						sounds.map((sound) => (
							<div
								key={sound.path}
								className="grid gap-2 border-b border-border/30 px-4 py-4 last:border-b-0"
								onContextMenu={() => void window.app.showAudioContextMenu(sound.path)}
							>
								<div className="flex items-center gap-2 text-xs">
									<Music className="size-3.5 shrink-0 text-muted-foreground" />
									<span className="min-w-0 flex-1 truncate font-medium">{sound.name}</span>
									<span className="shrink-0 text-[11px] text-muted-foreground">
										{new Date(sound.createdAt).toLocaleString()}
									</span>
								</div>
								<audio
									src={localResourceUrl(sound.path)}
									controls
									className="w-full rounded-xl border border-border/50 bg-muted/30 p-2"
								/>
							</div>
						))
					)}
				</SettingsPanel>
			</SettingsSection>
		</SettingsPageShell>
	);
};

export default MusicPage;
