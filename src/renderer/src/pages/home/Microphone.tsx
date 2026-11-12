import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { PromptInputAction } from '@/components/ui/prompt-input';
import { getMicrophoneInputs } from '@/lib/microphone/inputs';

export function Microphone({ disabled }: { readonly disabled?: boolean }): ReactElement {
	const { t } = useTranslation();
	const [inputs, setInputs] = useState<MediaDeviceInfo[]>([]);
	const [currentInput, setCurrentInput] = useState<MediaDeviceInfo | null>(null);
	const [inputId, setInputId] = useState('default');
	const refresh = useCallback(async () => {
		const [result, id] = await Promise.all([getMicrophoneInputs(), window.app.getMicrophoneInputId()]);
		setInputs(result.inputs);
		setCurrentInput(result.currentInput);
		setInputId(id);
	}, []);

	useEffect(() => {
		void refresh().catch(() => undefined);
		const onChange = (): void => void refresh().catch(() => undefined);
		navigator.mediaDevices?.addEventListener('devicechange', onChange);
		return () => navigator.mediaDevices?.removeEventListener('devicechange', onChange);
	}, [refresh]);

	const select = (id: string): void => {
		void window.app
			.setMicrophoneInputId(id)
			.then(() => setInputId(id))
			.catch(() => undefined);
	};
	const label = t('settings.system.media.microphone.label');
	const defaultLabel = t('settings.system.media.microphone.systemDefault');

	return (
		<DropdownMenu onOpenChange={(open) => open && void refresh().catch(() => undefined)}>
			<PromptInputAction tooltip={label}>
				<DropdownMenuTrigger asChild>
					<Button
						type="button"
						variant="ghost"
						size="icon"
						className="h-7 w-4 rounded-md text-foreground group-hover/mic:bg-muted/50 hover:bg-muted dark:group-hover/mic:bg-accent/50 dark:hover:bg-accent"
						aria-label={label}
						disabled={disabled}
					>
						<ChevronDown className="size-3.5" />
					</Button>
				</DropdownMenuTrigger>
			</PromptInputAction>
			<DropdownMenuContent align="start" side="top" className="w-72">
				<DropdownMenuItem onSelect={() => select('default')}>
					<span className="min-w-0 flex-1 truncate">
						{defaultLabel}
						{currentInput?.label ? ` (${currentInput.label})` : ''}
					</span>
					{inputId === 'default' && <Check className="size-4" />}
				</DropdownMenuItem>
				{inputs.length > 0 && <DropdownMenuSeparator />}
				{inputs.map((input, index) => (
					<DropdownMenuItem key={input.deviceId} onSelect={() => select(input.deviceId)}>
						<span className="min-w-0 flex-1 truncate">
							{input.label || t('settings.system.media.microphone.unnamed', { number: index + 1 })}
						</span>
						{inputId === input.deviceId && <Check className="size-4" />}
					</DropdownMenuItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
