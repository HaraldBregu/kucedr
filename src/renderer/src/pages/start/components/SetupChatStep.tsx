import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { SetupStepHeader } from './SetupStepHeader';
import { SetupCompaction } from './SetupCompaction';
import { SetupService, type SetupAssistantProps } from './SetupService';
import { MODEL_SERVICE_DEFINITIONS, STEP_COPY } from '../setupConstants';

export function SetupChatStep({
	serviceStates,
	loadingModels,
	savingConfig,
	onServiceChange,
}: SetupAssistantProps): React.JSX.Element {
	const [availableLocalModels, setAvailableLocalModels] = useState<string[]>([]);
	const [localProviderName, setLocalProviderName] = useState<string>();
	const assistantModelGroups = useMemo(
		() =>
			serviceStates.assistant.modelGroups.map((group) =>
				group.provider.id === 'ollama' && availableLocalModels.length > 0
					? {
							...group,
							provider: { ...group.provider, name: localProviderName ?? group.provider.name },
							models: availableLocalModels.map((id) => ({ id, name: id })),
						}
					: group
			),
		[availableLocalModels, localProviderName, serviceStates.assistant.modelGroups]
	);

	useEffect(() => {
		if (!window.provider) return;
		let cancelled = false;
		void window.provider
			.list('models')
			.then((providers) => providers.find((provider) => provider.id === 'custom'))
			.then(async (provider) => {
				if (!provider) return [];
				if (!cancelled) setLocalProviderName(provider.name);
				return window.provider.listCustomModels({
					baseUrl: provider.baseUrl,
					apiKey: provider.apiKey,
				});
			})
			.then((models) => {
				if (!cancelled) setAvailableLocalModels(models);
			})
			.catch(() => undefined);
		return () => {
			cancelled = true;
		};
	}, []);

	return (
		<div className="mx-auto flex min-h-full w-full min-w-0 max-w-2xl flex-col justify-center py-8">
			<SetupStepHeader title={STEP_COPY.chat.title} description={STEP_COPY.chat.description} />
			<div className="mt-6 grid min-w-0 gap-6">
				<section aria-label="Chat Assistant" className="min-w-0">
					<Card size="sm" className="gap-0! p-0!">
						<CardContent className="p-0!">
							<SetupService
								service={MODEL_SERVICE_DEFINITIONS.find((service) => service.id === 'assistant')!}
								state={{ ...serviceStates.assistant, modelGroups: assistantModelGroups }}
								disabled={loadingModels || savingConfig}
								onChange={onServiceChange}
							/>
							<SetupCompaction
								modelGroups={assistantModelGroups.map((group) => ({
									...group,
									models: group.models.filter((model) => model.id !== 'local'),
								}))}
								disabled={loadingModels || savingConfig}
							/>
						</CardContent>
					</Card>
				</section>
				<section aria-label="Tools" className="min-w-0">
					<h2 className="mb-2 px-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
						Tools
					</h2>
					<Card size="sm" className="gap-0! p-0!">
						<CardContent className="p-0!">
							{MODEL_SERVICE_DEFINITIONS.filter((service) =>
								['image', 'video', 'audio'].includes(service.id)
							).map((service) => (
								<SetupService
									key={service.id}
									service={service}
									state={serviceStates[service.id]}
									disabled={loadingModels || savingConfig}
									onChange={onServiceChange}
								/>
							))}
						</CardContent>
					</Card>
				</section>
			</div>
		</div>
	);
}
