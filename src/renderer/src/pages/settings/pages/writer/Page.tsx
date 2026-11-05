import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { WorkspaceTextSize } from '@shared/app_types';
import { Model } from '@/pages/home/Model';
import { ImageModel } from '@/pages/workspace/ImageModel';
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
	useEffect(() => {
		void Promise.all([window.app.getWorkspaceWideContent(), window.app.getWorkspaceTextSize()]).then(([nextWide, nextSize]) => {
			setWide(nextWide);
			setSize(nextSize);
			setLoaded(true);
		});
	}, []);
	return (
		<SettingsPageShell>
			<SettingsPageHeader title={t('settings.writer.title')} description={t('settings.writer.description')} />
			<SettingsPanel>
				<SettingsRow title={t('settings.writer.model')} description={t('settings.writer.modelDescription')} actionClassName="w-auto justify-end" actions={<Model workspace />} />
				<SettingsRow title={t('settings.writer.imageModel')} description={t('settings.writer.imageModelDescription')} actionClassName="w-auto justify-end" actions={<ImageModel />} />
				<SettingsRow title={t('settings.writer.wide')} description={t('settings.writer.wideDescription')} actionClassName="w-auto justify-end" actions={<Switch aria-label={t('settings.writer.wide')} disabled={!loaded} checked={wide} onCheckedChange={(next) => { setWide(next); void window.app.setWorkspaceWideContent(next); }} />} />
				<SettingsRow title={t('settings.writer.textSize')} description={t('settings.writer.textSizeDescription')} actionClassName="w-auto justify-end" actions={
					<Select value={size} disabled={!loaded} onValueChange={(next) => { if (next) { setSize(next); void window.app.setWorkspaceTextSize(next); } }}>
						<SelectTrigger aria-label={t('settings.writer.textSize')}><SelectValue>{t(`settings.writer.${SIZES.find((item) => item.value === size)?.key ?? 'medium'}`)}</SelectValue></SelectTrigger>
						<SelectContent>{SIZES.map((item) => <SelectItem key={item.value} value={item.value}>{t(`settings.writer.${item.key}`)}</SelectItem>)}</SelectContent>
					</Select>
				} />
			</SettingsPanel>
		</SettingsPageShell>
	);
}
