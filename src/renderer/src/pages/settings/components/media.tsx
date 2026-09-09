import React from 'react';
import { Camera, ChevronRight, Mic, MonitorUp, type LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { SettingsPanel, SettingsRow } from './index';

function MediaRow({
	icon,
	title,
	description,
	detailPath,
}: {
	readonly icon: LucideIcon;
	readonly title: string;
	readonly description: string;
	readonly detailPath: string;
}): React.JSX.Element {
	const navigate = useNavigate();
	const Icon = icon;

	return (
		<button
			type="button"
			onClick={() => navigate(detailPath)}
			className="block w-full text-left hover:bg-muted/40"
		>
			<SettingsRow
				title={title}
				description={description}
				media={<Icon className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />}
				className="grid-cols-[minmax(0,1fr)_auto]"
				actionClassName="w-auto justify-end"
				actions={<ChevronRight className="size-4 text-muted-foreground" />}
			/>
		</button>
	);
}

export function MediaPermissionsSection({
	className,
}: {
	readonly className?: string;
}): React.JSX.Element {
	const { t } = useTranslation();

	return (
		<SettingsPanel className={className}>
			<MediaRow
				icon={Mic}
				title={t('settings.system.media.microphone.label')}
				description={t('settings.system.media.microphone.description')}
				detailPath="/settings/system/media/microphone"
			/>
			<MediaRow
				icon={Camera}
				title={t('settings.system.media.camera.label')}
				description={t('settings.system.media.camera.description')}
				detailPath="/settings/system/media/camera"
			/>
			<MediaRow
				icon={MonitorUp}
				title={t('settings.system.media.screen.label')}
				description={t('settings.system.media.screen.description')}
				detailPath="/settings/system/media/screen"
			/>
		</SettingsPanel>
	);
}
