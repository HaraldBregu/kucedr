import type { ReactElement } from 'react';
import { Mic } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PromptInputAction } from '@/components/ui/prompt-input';
import type { VoiceButtonMode } from '../hooks';

export function VoiceButton({
	onVoiceModeRequest,
	disabled,
	disabledReason,
	mode,
}: {
	readonly onVoiceModeRequest: () => void;
	readonly disabled?: boolean;
	readonly disabledReason?: string;
	readonly mode: VoiceButtonMode;
}): ReactElement {
	const label = mode === 'record' ? 'Record voice' : 'Dictate';
	const isDisabled = disabled || mode === 'disabled';
	const tooltip =
		mode === 'disabled'
			? 'Choose a speech-to-text provider and model in Settings.'
			: (disabledReason ?? label);

	return (
		<PromptInputAction tooltip={tooltip} showTooltipWhenDisabled={isDisabled}>
			<Button
				type="button"
				variant="ghost"
				size="icon"
				className="size-9 rounded-full text-foreground hover:bg-muted"
				aria-label={tooltip}
				disabled={isDisabled}
				onClick={onVoiceModeRequest}
			>
				<Mic className="size-5" />
			</Button>
		</PromptInputAction>
	);
}
