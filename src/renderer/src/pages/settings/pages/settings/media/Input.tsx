import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectSeparator,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { getMicrophoneInputs } from '@/lib/microphone/inputs';
import { SettingsNotice, SettingsPanel, SettingsRow } from '../../../components';

export function MicrophoneInput({
	refreshKey,
	disabled,
}: {
	readonly refreshKey: string;
	readonly disabled: boolean;
}): React.JSX.Element {
	const { t } = useTranslation();
	const [inputs, setInputs] = useState<MediaDeviceInfo[]>([]);
	const [currentInput, setCurrentInput] = useState<MediaDeviceInfo | null>(null);
	const [inputId, setInputId] = useState('default');
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState('');
	const refresh = useCallback(async () => {
		try {
			const result = await getMicrophoneInputs();
			setInputs(result.inputs);
			setCurrentInput(result.currentInput);
			setError('');
		} catch {
			setError(t('settings.system.media.microphone.loadInputsError'));
		}
	}, [t]);

	useEffect(() => {
		void window.app
			.getMicrophoneInputId()
			.then(setInputId)
			.catch(() => {
				setError(t('settings.system.media.microphone.loadInputsError'));
			})
			.finally(() => setLoading(false));
	}, [t]);

	useEffect(() => {
		void refresh();
		const onChange = (): void => {
			void refresh();
		};
		navigator.mediaDevices?.addEventListener('devicechange', onChange);
		window.addEventListener('focus', onChange);
		return () => {
			navigator.mediaDevices?.removeEventListener('devicechange', onChange);
			window.removeEventListener('focus', onChange);
		};
	}, [refresh, refreshKey]);

	const selectedIndex = inputs.findIndex((input) => input.deviceId === inputId);
	const unavailable = inputId !== 'default' && selectedIndex === -1;
	const defaultLabel = t('settings.system.media.microphone.systemDefault');
	const selectedLabel =
		inputId === 'default'
			? defaultLabel
			: selectedIndex === -1
				? t('settings.system.media.microphone.unavailable')
				: inputs[selectedIndex].label ||
					t('settings.system.media.microphone.unnamed', { number: selectedIndex + 1 });

	return (
		<>
			<SettingsPanel>
				<SettingsRow
					title={t('settings.system.media.microphone.label')}
					description={t('settings.system.media.microphone.inputDescription')}
					actionClassName="sm:max-w-72"
				>
					<Select
						value={inputId}
						disabled={disabled || loading || saving}
						onOpenChange={(open) => {
							if (open) void refresh();
						}}
						onValueChange={(value) => {
							if (!value) return;
							setSaving(true);
							void window.app
								.setMicrophoneInputId(value)
								.then(() => {
									setInputId(value);
									setError('');
								})
								.catch(() => {
									setError(t('settings.system.media.microphone.saveInputError'));
								})
								.finally(() => setSaving(false));
						}}
					>
						<SelectTrigger
							className="w-full min-w-0 sm:w-64"
							aria-label={t('settings.system.media.microphone.label')}
						>
							<SelectValue className="min-w-0">
								<span className="truncate">{selectedLabel}</span>
							</SelectValue>
						</SelectTrigger>
						<SelectContent
							align="end"
							alignItemWithTrigger={false}
							className="w-80 max-w-[calc(100vw-2rem)] p-1"
						>
							<SelectItem value="default" className="[&>div]:min-w-0 [&>div]:shrink">
								<span className="min-w-0 truncate" title={currentInput?.label || defaultLabel}>
									{defaultLabel}
									{currentInput?.label ? ` (${currentInput.label})` : ''}
								</span>
							</SelectItem>
							{inputs.length > 0 && <SelectSeparator />}
							{inputs.map((input, index) => (
								<SelectItem
									key={input.deviceId}
									value={input.deviceId}
									className="[&>div]:min-w-0 [&>div]:shrink"
								>
									<span className="truncate" title={input.label}>
										{input.label ||
											t('settings.system.media.microphone.unnamed', { number: index + 1 })}
									</span>
								</SelectItem>
							))}
							{unavailable && (
								<SelectItem value={inputId} disabled>
									{t('settings.system.media.microphone.unavailable')}
								</SelectItem>
							)}
						</SelectContent>
					</Select>
				</SettingsRow>
			</SettingsPanel>
			{error && <SettingsNotice variant="destructive">{error}</SettingsNotice>}
		</>
	);
}
