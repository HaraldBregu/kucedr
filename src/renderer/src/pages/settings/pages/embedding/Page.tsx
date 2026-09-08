import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, LoaderCircle, Sparkles } from 'lucide-react';
import { defaultProviderId, providerIdsFor, providerModels } from '@/lib/providers';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { type ModelProviderGroup, ModelProviderSelect } from '@/components/model-provider-select';
import {
	SettingsField,
	SettingsNotice,
	SettingsPageHeader,
	SettingsPageShell,
	SettingsPanel,
	SettingsSection,
} from '../../components';

function embeddingProviderGroups(): readonly ModelProviderGroup[] {
	return providerIdsFor('embedding').map((id) => ({
		id,
		models: providerModels(id, 'embedding'),
	}));
}

const EmbeddingPage: React.FC = () => {
	const { t } = useTranslation();
	const [providerId, setProviderId] = useState('');
	const [modelId, setModelId] = useState('');
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [saved, setSaved] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [input, setInput] = useState('');
	const [embedding, setEmbedding] = useState(false);
	const [dimensions, setDimensions] = useState<number | null>(null);

	useEffect(() => {
		let mounted = true;
		void (async () => {
			try {
				const [storedProviderId, storedModelId] = await Promise.all([
					window.models.embedding.getProviderId(),
					window.models.embedding.getModelId(),
				]);
				if (!mounted) return;
				const nextProviderId =
					storedProviderId &&
					embeddingProviderGroups().some((group) => group.id === storedProviderId)
						? storedProviderId
						: (defaultProviderId('embedding') ?? '');
				const models =
					embeddingProviderGroups().find((group) => group.id === nextProviderId)?.models ?? [];
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
			await window.models.embedding.setProviderId(nextProviderId);
			await window.models.embedding.setModelId(nextModelId);
			setSaved(true);
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setSaving(false);
		}
	};

	const handleEmbed = async (): Promise<void> => {
		if (!input.trim() || !providerId || !modelId) return;
		setEmbedding(true);
		setError(null);
		setDimensions(null);
		try {
			const result = await window.models.embedding.createEmbedding({
				texts: [input],
				providerId,
				modelId,
			});
			setDimensions(result.dimensions);
		} catch (err) {
			setError(
				err instanceof Error && err.message.trim()
					? err.message
					: t('settings.embedding.embedError')
			);
		} finally {
			setEmbedding(false);
		}
	};

	return (
		<SettingsPageShell>
			<SettingsPageHeader
				title={t('settings.modelServices.embeddingName')}
				description={t('settings.modelServices.embeddingDescription')}
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
							idPrefix="embedding"
							providerGroups={embeddingProviderGroups()}
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

			<SettingsSection title={t('settings.embedding.input')}>
				<SettingsPanel>
					<div className="grid gap-3 px-4 py-4">
						<SettingsField
							id="embedding-input"
							label={t('settings.embedding.input')}
							description={t('settings.embedding.inputDescription')}
						>
							<Textarea
								id="embedding-input"
								value={input}
								placeholder={t('settings.embedding.inputPlaceholder')}
								disabled={embedding}
								onChange={(event) => setInput(event.target.value)}
							/>
						</SettingsField>

						<div className="flex justify-end">
							<Button
								type="button"
								size="sm"
								disabled={embedding || loading || !input.trim() || !providerId || !modelId}
								onClick={() => void handleEmbed()}
							>
								{embedding ? (
									<LoaderCircle className="size-3 animate-spin" />
								) : (
									<Sparkles className="size-3" />
								)}
								{embedding ? t('settings.embedding.embedding') : t('settings.embedding.embed')}
							</Button>
						</div>

						{dimensions !== null && (
							<p className="text-[11px] leading-4 text-muted-foreground">
								{t('settings.embedding.result', { dimensions })}
							</p>
						)}
					</div>
				</SettingsPanel>
			</SettingsSection>
		</SettingsPageShell>
	);
};

export default EmbeddingPage;
