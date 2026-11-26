import React from 'react';
import { useTranslation } from 'react-i18next';
import { Radio } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import VoiceConfiguration from '@pages/settings/pages/assistant/voice';
import { SetupMediaTools } from './SetupMediaTools';
import { SetupStepHeader } from './SetupStepHeader';
import type { SetupAssistantProps } from './SetupService';

export function SetupVoiceStep({
	serviceStates,
	loadingModels,
	savingConfig,
	onServiceChange,
}: SetupAssistantProps): React.JSX.Element {
	const { t } = useTranslation();
	return (
		<div className="mx-auto flex min-h-full w-full min-w-0 max-w-2xl flex-col justify-center py-8">
			<SetupStepHeader title={t('start.steps.voice.title')} description={t('start.steps.voice.description')} />
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
