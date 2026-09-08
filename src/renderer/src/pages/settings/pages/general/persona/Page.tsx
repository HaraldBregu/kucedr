import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Persona, type PersonaState } from '@/components/persona';
import { Button } from '@/components/ui/button';
import {
	SettingsPageHeader,
	SettingsPageShell,
	SettingsPanel,
	SettingsSection,
} from '../../../components';

const PERSONA_STATES: readonly PersonaState[] = ['idle', 'listening', 'thinking', 'speaking'];

const PersonaPage: React.FC = () => {
	const { t } = useTranslation();
	const [state, setState] = useState<PersonaState>('idle');

	return (
		<SettingsPageShell>
			<SettingsPageHeader
				title={t('settings.persona.title')}
				description={t('settings.persona.description')}
			/>

			<SettingsSection
				title={t('settings.persona.preview')}
				description={t('settings.persona.previewDescription')}
			>
				<SettingsPanel className="overflow-hidden">
					<div className="flex min-h-96 flex-col items-center justify-center gap-4 bg-neutral-950 p-7">
						<Persona state={state} level={state === 'speaking' ? 0.72 : 0.28} />
						<div className="flex flex-wrap items-center justify-center gap-1.5">
							{PERSONA_STATES.map((personaState) => (
								<Button
									key={personaState}
									type="button"
									variant={state === personaState ? 'secondary' : 'ghost'}
									size="xs"
									aria-pressed={state === personaState}
									className="text-neutral-300 hover:bg-white/10 hover:text-white"
									onClick={() => setState(personaState)}
								>
									{t(`settings.persona.states.${personaState}`)}
								</Button>
							))}
						</div>
					</div>
				</SettingsPanel>
			</SettingsSection>
		</SettingsPageShell>
	);
};

export default PersonaPage;
