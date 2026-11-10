import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { WorkspaceTextSize } from '@shared/app_types';
import { Model } from '@/pages/home/Model';
import { MediaModel } from '@/pages/workspace/MediaModel';
import { Option } from '@/pages/workspace/Option';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { SettingsPageHeader, SettingsPageShell, SettingsPanel, SettingsRow } from '../../components';

const SIZES: { value: WorkspaceTextSize; key: string }[] = [
	{ value: 'extra-small', key: 'extraSmall' },
	{ value: 'small', key: 'small' },
	{ value: 'medium', key: 'medium' },
	{ value: 'large', key: 'large' },
	{ value: 'extra-large', key: 'extraLarge' },
];

export default function WriterPage(): React.JSX.Element {
	const { t } = useTranslation();
	const [wide, setWide] = useState(false);
	const [size, setSize] = useState<WorkspaceTextSize>('medium');
	const [loaded, setLoaded] = useState(false);
	const [imageSelection, setImageSelection] = useState({ providerId: '', modelId: '' });
	const [voiceSelection, setVoiceSelection] = useState({ providerId: '', modelId: '' });
	useEffect(() => {
		void Promise.all([window.app.getWorkspaceWideContent(), window.app.getWorkspaceTextSize()]).then(([nextWide, nextSize]) => {
			setWide(nextWide);
			setSize(nextSize);
			setLoaded(true);
		});
	}, []);
	return (
		<SettingsPageShell>
			<SettingsPageHeader title={t('settings.editor.title')} description={t('settings.editor.description')} />
			<SettingsPanel>
				<SettingsRow title={t('settings.editor.wide')} description={t('settings.editor.wideDescription')} actionClassName="w-auto justify-end" actions={<Switch aria-label={t('settings.editor.wide')} disabled={!loaded} checked={wide} onCheckedChange={(next) => { setWide(next); void window.app.setWorkspaceWideContent(next); }} />} />
				<SettingsRow title={t('settings.editor.textSize')} description={t('settings.editor.textSizeDescription')} actionClassName="w-auto justify-end" actions={
					<Select value={size} disabled={!loaded} onValueChange={(next) => { if (next) { setSize(next); void window.app.setWorkspaceTextSize(next); } }}>
						<SelectTrigger aria-label={t('settings.editor.textSize')}><SelectValue>{t(`settings.editor.${SIZES.find((item) => item.value === size)?.key ?? 'medium'}`)}</SelectValue></SelectTrigger>
						<SelectContent>{SIZES.map((item) => <SelectItem key={item.value} value={item.value}>{t(`settings.editor.${item.key}`)}</SelectItem>)}</SelectContent>
					</Select>
				} />
			</SettingsPanel>
			<SettingsPanel>
				<SettingsRow title={t('settings.editor.model')} description={t('settings.editor.modelDescription')} actionClassName="w-auto justify-end" actions={<Model workspace />} />
			</SettingsPanel>
			<SettingsPanel>
				<SettingsRow title={t('settings.editor.imageModel')} description={t('settings.editor.imageModelDescription')} actionClassName="w-auto justify-end" actions={<MediaModel kind="image" onSelectionChange={setImageSelection} />} />
				<SettingsRow title={t('settings.editor.aspectRatio')} description={t('settings.editor.aspectRatioDescription')} actionClassName="w-auto justify-end" actions={<Option capability="text-to-image" names={['aspect_ratio', 'size']} label={t('settings.editor.aspectRatio')} {...imageSelection} />} />
			</SettingsPanel>
			<SettingsPanel>
				<SettingsRow title={t('settings.editor.voiceModel')} description={t('settings.editor.voiceModelDescription')} actionClassName="w-auto justify-end" actions={<MediaModel kind="voice" onSelectionChange={setVoiceSelection} />} />
				<SettingsRow title={t('settings.editor.voice')} description={t('settings.editor.voiceDescription')} actionClassName="w-auto justify-end" actions={<Option capability="text-to-speech" names={['voice', 'voice_id']} label={t('settings.editor.voice')} {...voiceSelection} />} />
			</SettingsPanel>
		</SettingsPageShell>
	);
}
