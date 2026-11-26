import { AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { SettingsNotice } from './index';

export default function Portability(): React.JSX.Element {
	const { t } = useTranslation();
	return (
		<SettingsNotice
			icon={AlertTriangle}
			className="border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
		>
			{t('settings.storageProviders.portabilityWarning')}
		</SettingsNotice>
	);
}
