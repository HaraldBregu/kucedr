import React from 'react';
import { useTranslation } from 'react-i18next';
import { Image, Music2, Video } from 'lucide-react';
import type { AgentToolProfileId } from '@shared/agent_tools';
import { AgentMediaModelConfiguration } from './media';
import { toolModelApi } from './toolmodel';

export function ProfileMediaModels({
	profileId,
}: {
	readonly profileId: AgentToolProfileId;
}): React.JSX.Element {
	const { t } = useTranslation();

	return (
		<>
			<AgentMediaModelConfiguration
				api={toolModelApi('audio', profileId)}
				capability="text-to-audio"
				idPrefix={`${profileId}-music`}
				title={t('settings.tabs.music')}
				description={t('settings.modelServices.musicModelDescription')}
				icon={Music2}
				grouped
				showSelectedModel
				buttonDropdown
				showContentSeparator={false}
				inlineAdvanced
			/>
			<AgentMediaModelConfiguration
				api={toolModelApi('image', profileId)}
				capability="text-to-image"
				idPrefix={`${profileId}-image`}
				title={t('settings.tabs.image')}
				description={t('settings.modelServices.imageModelDescription')}
				icon={Image}
				grouped
				showSelectedModel
				buttonDropdown
				showContentSeparator={false}
				inlineAdvanced
			/>
			<AgentMediaModelConfiguration
				api={toolModelApi('video', profileId)}
				capability="text-to-video"
				idPrefix={`${profileId}-video`}
				title={t('settings.tabs.video')}
				description={t('settings.modelServices.videoModelDescription')}
				icon={Video}
				grouped
				showSelectedModel
				buttonDropdown
				showContentSeparator={false}
				inlineAdvanced
			/>
		</>
	);
}
