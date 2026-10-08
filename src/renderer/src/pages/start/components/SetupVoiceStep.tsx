import React from 'react';
import { Radio } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import VoiceConfiguration from '@pages/settings/pages/assistant/voice';
import { SetupMediaTools } from './SetupMediaTools';
import { SetupStepHeader } from './SetupStepHeader';
import { SetupService, type SetupAssistantProps } from './SetupService';
import { MODEL_SERVICE_DEFINITIONS, STEP_COPY } from '../setupConstants';

export function SetupVoiceStep({
	serviceStates,
	loadingModels,
	savingConfig,
	onServiceChange,
}: SetupAssistantProps): React.JSX.Element {
	return (
		<div className="mx-auto flex min-h-full w-full min-w-0 max-w-2xl flex-col justify-center py-8">
			<SetupStepHeader title={STEP_COPY.voice.title} description={STEP_COPY.voice.description} />
			<div className="mt-6 grid min-w-0 gap-6">
				<section aria-label="Voice Assistant" className="min-w-0">
					<Card size="sm" className="gap-0! p-0!">
						<CardContent className="p-0!">
							<VoiceConfiguration
								selectDefaultModel={false}
								showFieldLabel={false}
								showSelectedModel
								buttonDropdown
								buttonClassName="w-40 min-w-0"
								icon={Radio}
								pluginItemStyle
							/>
							{MODEL_SERVICE_DEFINITIONS.filter(
								(service) => service.id === 'voice' || service.id === 'transcription'
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
				<SetupMediaTools
					serviceStates={serviceStates}
					loadingModels={loadingModels}
					savingConfig={savingConfig}
					onServiceChange={onServiceChange}
				/>
			</div>
		</div>
	);
}
