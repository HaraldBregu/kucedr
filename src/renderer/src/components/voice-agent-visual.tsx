import { Persona, type PersonaState } from '@/components/persona';
import { Orb07 } from '@/components/orbs/orb-07';
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
	const visualState = state === 'listening' ? 'idle' : state;

	if (appearance === 'orb-07') {
		return (
			<Orb07
				ariaLabel={`Voice Agent is ${visualState}`}
				className={className}
				maxDpr={2}
				size={size}
				state={visualState}
				volumes={{ input: level, output: level }}
			/>
		);
	}

	return <Persona className={className} level={level} size={size} state={visualState} />;
}
