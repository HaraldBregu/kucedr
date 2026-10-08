import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { SetupService, type SetupAssistantProps } from './SetupService';
import { MODEL_SERVICE_DEFINITIONS } from '../setupConstants';

export function SetupMediaTools({
	serviceStates,
	loadingModels,
	savingConfig,
	onServiceChange,
}: SetupAssistantProps): React.JSX.Element {
	return (
		<section aria-label="Media tools" className="min-w-0">
			<h2 className="mb-2 px-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
				Media tools
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
	);
}
