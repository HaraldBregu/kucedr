import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, LoaderCircle, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useReadMessageAloud } from '@/pages/home/hooks';
import { SettingsNotice, SettingsPanel } from '../../components';

const VoiceTest: React.FC = () => {
	const { t } = useTranslation();
	const [text, setText] = useState(() => t('settings.modelServices.testVoiceExample'));
	const { speak, isSpeaking, errorMessage } = useReadMessageAloud();

	return (
		<SettingsPanel>
			<div className="grid gap-3 px-4 py-4">
				{errorMessage && (
					<SettingsNotice variant="destructive" icon={AlertTriangle}>
						{errorMessage}
					</SettingsNotice>
				)}
				<Textarea
					value={text}
					onChange={(event) => setText(event.target.value)}
					placeholder={t('settings.modelServices.testVoicePlaceholder')}
					className="text-xs"
					rows={3}
					disabled={isSpeaking}
				/>
				<div className="flex justify-end">
					<Button
						type="button"
						size="sm"
						disabled={isSpeaking || !text.trim()}
						onClick={() => speak(text)}
					>
						{isSpeaking ? (
							<LoaderCircle className="size-3 animate-spin" />
						) : (
							<Volume2 className="size-3" />
						)}
						{isSpeaking
							? t('settings.modelServices.testVoiceSpeaking')
							: t('settings.modelServices.testVoiceSpeak')}
					</Button>
				</div>
			</div>
		</SettingsPanel>
	);
};

export default VoiceTest;
