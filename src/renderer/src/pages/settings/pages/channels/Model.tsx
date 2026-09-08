import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ChannelModelKind } from '@shared/channels_types';
import { ModelProviderConfiguration } from '../../components/model-configuration';
import {
	firstErrorMessage,
	initialModelConfigurationState,
} from '../../components/model-configuration-state';
import { loadChannelModelState } from './load';

export function ChannelModelConfiguration({
	kind,
}: {
	readonly kind: ChannelModelKind;
}): React.JSX.Element {
	const { t } = useTranslation();
	const [state, setState] = useState(initialModelConfigurationState);
	useEffect(() => {
		let mounted = true;
		setState(initialModelConfigurationState);
		void loadChannelModelState(kind, t).then((next) => {
			if (mounted) setState(next);
		});
		return () => {
			mounted = false;
		};
	}, [kind, t]);

	const save = async (providerId: string, modelId: string): Promise<void> => {
		const group = state.modelGroups.find((item) => item.provider.id === providerId);
		if (!group?.models.some((model) => model.id === modelId)) return;
		setState((current) => ({
			...current,
			providerId,
			modelId,
			saving: true,
			saved: false,
			error: null,
		}));
		try {
			await window.app.setChannelsModelSelection(kind, providerId, modelId);
			setState((current) => ({ ...current, saving: false, saved: true }));
		} catch (error) {
			setState((current) => ({
				...current,
				saving: false,
				error: firstErrorMessage(error, t('settings.modelServices.saveError')),
			}));
		}
	};

	return (
		<ModelProviderConfiguration
			configState={state}
			idPrefix={`channels-${kind}`}
			triggerTitle={t(`settings.channels.${kind}Model`)}
			description={t(`settings.channels.${kind}ModelDescription`)}
			showInlineError
			onChange={(providerId, modelId) => void save(providerId, modelId)}
		/>
	);
}
