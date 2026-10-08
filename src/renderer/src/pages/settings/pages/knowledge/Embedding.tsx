import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { BrainCircuit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { SettingsPanel, SettingsRow, SettingsSection } from '../../components';
import { VALUE_SEPARATOR, type KnowledgeState } from './state';

export default function Embedding({ knowledge }: { knowledge: KnowledgeState }): JSX.Element {
	const { t } = useTranslation();
	const {
		configuration,
		disabled,
		embeddingModels,
		selectedEmbeddingModel,
		embeddingConsentMatches,
		save,
	} = knowledge;
	return (
		<SettingsSection
			title={t('settings.knowledge.embeddingTitle')}
			action={
				<Button
					variant="outline"
					size="sm"
					disabled={disabled}
					nativeButton={false}
					render={<Link to="/settings/providers/models" />}
				>
					{t('settings.knowledge.configureModels')}
				</Button>
			}
		>
			<SettingsPanel>
				<SettingsRow
					title={t('settings.knowledge.embeddingModelTitle')}
					description={t('settings.knowledge.embeddingModelDescription')}
					icon={BrainCircuit}
					className="sm:grid-cols-1 lg:grid-cols-[minmax(0,1fr)_auto]"
					actionClassName="sm:ml-0 sm:w-full sm:justify-start lg:ml-auto lg:w-auto lg:justify-end"
					actions={
						<Select
							value={
								selectedEmbeddingModel
									? `${selectedEmbeddingModel.provider.id}${VALUE_SEPARATOR}${selectedEmbeddingModel.id}`
									: null
							}
							disabled={disabled || embeddingModels.length === 0}
							onValueChange={(value) => {
								if (!value) return;
								const [embeddingProviderId, embeddingModelId] = value.split(VALUE_SEPARATOR);
								void save({ embeddingProviderId, embeddingModelId, embeddingConsent: null });
							}}
						>
							<SelectTrigger
								aria-label={t('settings.knowledge.embeddingModelTitle')}
								size="sm"
								className="w-64 max-w-full text-xs"
							>
								<SelectValue placeholder={t('settings.modelServices.modelPlaceholder')}>
									{selectedEmbeddingModel &&
										`${selectedEmbeddingModel.provider.name} / ${selectedEmbeddingModel.name || selectedEmbeddingModel.id}`}
								</SelectValue>
							</SelectTrigger>
							<SelectContent>
								{embeddingModels.map((model) => (
									<SelectItem
										key={`${model.provider.id}${VALUE_SEPARATOR}${model.id}`}
										value={`${model.provider.id}${VALUE_SEPARATOR}${model.id}`}
									>{`${model.provider.name} / ${model.name || model.id}`}</SelectItem>
								))}
							</SelectContent>
						</Select>
					}
				/>
				<SettingsRow
					title={t('settings.knowledge.embeddingConsent')}
					description={t('settings.knowledge.embeddingConsentDescription')}
					className="grid-cols-[minmax(0,1fr)_auto]"
					actionClassName="ml-auto w-auto justify-end"
					actions={
						<Switch
							checked={embeddingConsentMatches}
							disabled={disabled || !selectedEmbeddingModel}
							aria-label={t('settings.knowledge.embeddingConsent')}
							onCheckedChange={(enabled) =>
								void save({
									embeddingConsent:
										enabled && configuration
											? {
													providerId: configuration.embeddingProviderId,
													modelId: configuration.embeddingModelId,
													version: 1,
												}
											: null,
								})
							}
						/>
					}
				/>
			</SettingsPanel>
		</SettingsSection>
	);
}
