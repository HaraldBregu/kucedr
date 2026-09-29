import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { PersonaState } from '@/components/persona';
import { VoiceAgentVisual } from '@/components/voice-agent-visual';
import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useApp, type VoiceAgentAppearance } from '@/contexts';
import {
	SettingsPageHeader,
	SettingsPageShell,
	SettingsPanel,
	SettingsSection,
} from '../../../components';

const PERSONA_STATES: readonly PersonaState[] = ['idle', 'listening', 'thinking', 'speaking'];
const APPEARANCES: readonly VoiceAgentAppearance[] = ['persona', 'orb-07'];

const PersonaPage: React.FC = () => {
	const { t } = useTranslation();
	const [state, setState] = useState<PersonaState>('idle');
	const { voiceAgentAppearance, setVoiceAgentAppearance } = useApp();

	return (
		<SettingsPageShell>
			<SettingsPageHeader
				title={t('settings.voiceAgent.title')}
				description={t('settings.voiceAgent.description')}
			/>

			<SettingsSection
				title={t('settings.voiceAgent.appearance')}
				description={t('settings.voiceAgent.appearanceDescription')}
			>
				<SettingsPanel className="p-3">
					<ToggleGroup
						type="single"
						value={voiceAgentAppearance}
						aria-label={t('settings.voiceAgent.appearance')}
						className="justify-start gap-1 rounded-lg bg-muted p-1"
						onValueChange={(value) => {
							if (APPEARANCES.includes(value as VoiceAgentAppearance)) {
								setVoiceAgentAppearance(value as VoiceAgentAppearance);
							}
						}}
					>
						{APPEARANCES.map((appearance) => (
							<ToggleGroupItem
								key={appearance}
								value={appearance}
								className="h-8 min-w-24 px-3 text-xs data-[pressed]:bg-background data-[pressed]:shadow-sm"
							>
								{t(`settings.voiceAgent.appearances.${appearance}`)}
							</ToggleGroupItem>
						))}
					</ToggleGroup>
				</SettingsPanel>
			</SettingsSection>

			<SettingsSection
				title={t('settings.voiceAgent.preview')}
				description={t('settings.voiceAgent.previewDescription')}
			>
				<SettingsPanel className="overflow-hidden">
					<div className="flex min-h-96 flex-col items-center justify-center gap-4 bg-neutral-950 p-7">
						<VoiceAgentVisual
							appearance={voiceAgentAppearance}
							state={state}
							level={state === 'speaking' ? 0.72 : 0.28}
						/>
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
									{t(`settings.voiceAgent.states.${personaState}`)}
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
