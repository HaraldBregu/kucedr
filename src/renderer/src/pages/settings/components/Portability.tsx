import { AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { SettingsNotice } from './index';

export default function Portability(): React.JSX.Element {
	const { t } = useTranslation();
	return (
		<SettingsNotice
			icon={AlertTriangle}
			className="border-border bg-muted/40 text-foreground"
		>
			{t('settings.storageProviders.portabilityWarning')}
		</SettingsNotice>
	);
}
