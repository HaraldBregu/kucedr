import { Orb } from 'orb-ui';
import { Persona, type PersonaState } from '@/components/persona';
import type { VoiceAgentAppearance } from '../../../shared/app_types';

interface VoiceAgentVisualProps {
	readonly appearance: VoiceAgentAppearance;
	readonly className?: string;
	readonly level?: number;
	readonly size?: number;
	readonly state?: PersonaState;
}

export function VoiceAgentVisual({
	appearance,
	className,
	level = 0.16,
	size = 260,
	state = 'idle',
}: VoiceAgentVisualProps): React.JSX.Element {
	if (appearance !== 'persona') {
		return (
			<Orb
				aria-label={`Voice Agent is ${state}`}
				className={className}
				interactive={false}
				signal={{
					state,
					inputVolume: state === 'listening' ? level : 0,
					outputVolume: state === 'speaking' ? level : 0,
				}}
				size={size}
				theme={appearance}
			/>
		);
	}

	const visualState = state === 'listening' ? 'idle' : state;
	return <Persona className={className} level={level} size={size} state={visualState} />;
}
