import React from 'react';
import { Camera, ChevronRight, Mic, MonitorUp, type LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Item, ItemActions, ItemContent, ItemIcon, ItemTitle } from '@/components/ui/item';
import { SettingsPanel } from './index';

function MediaRow({
	icon,
	title,
	detailPath,
}: {
	readonly icon: LucideIcon;
	readonly title: string;
	readonly detailPath: string;
}): React.JSX.Element {
	const navigate = useNavigate();

	return (
		<Item
			as="button"
			type="button"
			onClick={() => navigate(detailPath)}
			variant="outline"
			size="md"
			className="min-h-11 border-b border-border/60 text-left last:border-b-0 hover:bg-muted/40 px-5 py-4"
		>
			<ItemIcon icon={icon} className="[&_svg]:size-4" />
			<ItemContent className="min-w-0 flex-1">
				<ItemTitle className="truncate">{title}</ItemTitle>
			</ItemContent>
			<ItemActions className="ml-auto flex-none items-center justify-end">
				<ChevronRight className="size-4 text-muted-foreground" />
			</ItemActions>
		</Item>
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
				detailPath="/settings/system/media/microphone"
			/>
			<MediaRow
				icon={Camera}
				title={t('settings.system.media.camera.label')}
				detailPath="/settings/system/media/camera"
			/>
			<MediaRow
				icon={MonitorUp}
				title={t('settings.system.media.screen.label')}
				detailPath="/settings/system/media/screen"
			/>
		</SettingsPanel>
	);
}
