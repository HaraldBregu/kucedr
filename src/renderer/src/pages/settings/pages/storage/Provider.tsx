import { useTranslation } from 'react-i18next';
import { SettingsPanel, SettingsRow } from '../../components';

export default function Provider(): React.JSX.Element {
	const { t } = useTranslation();

	return (
		<SettingsPanel>
			<SettingsRow
				title={t('settings.storage.provider.title')}
				description={t('settings.storage.provider.description')}
			/>
		</SettingsPanel>
	);
}
