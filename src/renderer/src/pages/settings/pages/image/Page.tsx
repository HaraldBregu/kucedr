import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, LoaderCircle, Sparkles } from 'lucide-react';
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

function imageProviderGroups(): readonly ModelProviderGroup[] {
	return providerIdsFor('text-to-image').map((id) => ({
		id,
		models: providerModels(id, 'text-to-image'),
	}));
}

const ImagePage: React.FC = () => {
	const { t } = useTranslation();
	const [providerId, setProviderId] = useState('');
	const [modelId, setModelId] = useState('');
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [saved, setSaved] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [prompt, setPrompt] = useState('');
	const [generating, setGenerating] = useState(false);
	const [imageSrc, setImageSrc] = useState<string | null>(null);

	useEffect(() => {
		let mounted = true;
		void (async () => {
			try {
				const [storedProviderId, storedModelId] = await Promise.all([
					window.models.image.getProviderId(),
					window.models.image.getModelId(),
				]);
				if (!mounted) return;
				const nextProviderId =
					storedProviderId &&
					imageProviderGroups().some((group) => group.id === storedProviderId)
						? storedProviderId
						: (imageProviderGroups()[0]?.id ?? '');
				const models =
					imageProviderGroups().find((group) => group.id === nextProviderId)?.models ?? [];
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
			await window.models.image.setProviderId(nextProviderId);
			await window.models.image.setModelId(nextModelId);
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
			const result = await window.models.image.createImage({ prompt, providerId, modelId });
			setImageSrc(`data:${result.mimeType};base64,${result.base64}`);
		} catch (err) {
			setError(
				err instanceof Error && err.message.trim()
					? err.message
					: t('settings.image.generateError')
			);
		} finally {
			setGenerating(false);
		}
	};

	return (
		<SettingsPageShell>
			<SettingsPageHeader
				title={t('settings.modelServices.imageAssistantName')}
				description={t('settings.modelServices.imageAssistantDescription')}
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
							idPrefix="image"
							providerGroups={imageProviderGroups()}
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

			<SettingsSection title={t('settings.image.prompt')}>
				<SettingsPanel>
					<div className="grid gap-3 px-4 py-4">
						<SettingsField
							id="image-prompt"
							label={t('settings.image.prompt')}
							description={t('settings.image.promptDescription')}
						>
							<Textarea
								id="image-prompt"
								value={prompt}
								placeholder={t('settings.image.promptPlaceholder')}
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
								{generating ? t('settings.image.generating') : t('settings.image.generate')}
							</Button>
						</div>

						{imageSrc && (
							<img
								src={imageSrc}
								alt={t('settings.image.resultAlt')}
								className="w-full rounded-lg border border-border/70"
							/>
						)}
					</div>
				</SettingsPanel>
			</SettingsSection>
		</SettingsPageShell>
	);
};

export default ImagePage;
