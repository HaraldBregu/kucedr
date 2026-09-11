import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
	AlertTriangle,
	Image as ImageIcon,
	Mic,
	Music2,
	Search as SearchIcon,
	Video,
	Volume2,
} from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import type { AgentToolModelKind } from '@shared/agent_types';
import {
	SettingsNotice,
	SettingsPageHeader,
	SettingsPageShell,
	SettingsPanel,
} from '../../../components';
import { firstErrorMessage } from '../../../components/model-configuration-state';
import { SEARCH_ENGINES } from '../../search/catalog';
import type { SearchEngineId, SearchSettings } from '../../../../../../../../shared/search_types';
import { AgentMediaModelConfiguration } from '../media';

function toolModelApi(kind: AgentToolModelKind) {
	return {
		getProviderId: async (): Promise<string | undefined> =>
			(await window.agent.getToolModel(kind)).providerId || undefined,
		setProviderId: async (providerId: string): Promise<void> => {
			const current = await window.agent.getToolModel(kind);
			await window.agent.setToolModel(kind, { ...current, providerId });
		},
		getModelId: async (): Promise<string | undefined> =>
			(await window.agent.getToolModel(kind)).modelId || undefined,
		setModelId: async (modelId: string): Promise<void> => {
			const current = await window.agent.getToolModel(kind);
			await window.agent.setToolModel(kind, { ...current, modelId });
		},
		getOptions: async (): Promise<Record<string, unknown>> =>
			(await window.agent.getToolModel(kind)).options,
		setOptions: async (options: Record<string, unknown>): Promise<Record<string, unknown>> =>
			(
				await window.agent.setToolModel(kind, {
					...(await window.agent.getToolModel(kind)),
					options,
				})
			).options,
	};
}

const TOOL_IMAGE_API = toolModelApi('image');
const TOOL_AUDIO_API = toolModelApi('audio');
const TOOL_VIDEO_API = toolModelApi('video');
const TOOL_TEXT_TO_SPEECH_API = toolModelApi('textToSpeech');
const TOOL_SPEECH_TO_TEXT_API = toolModelApi('speechToText');

const ToolsPage: React.FC = () => {
	const { t } = useTranslation();
	const [searchSettings, setSearchSettings] = useState<SearchSettings | null>(null);
	const [searchEngineError, setSearchEngineError] = useState<string | null>(null);
	const [searchSavingEngineId, setSearchSavingEngineId] = useState<SearchEngineId | null>(null);
	const selectedSearchEngine = SEARCH_ENGINES.find(
		(engine) => engine.id === searchSettings?.engineId
	);
	const selectedSearchEngineDescription = selectedSearchEngine
		? t(selectedSearchEngine.descriptionKey)
		: t('settings.searchEngine.defaultDescription');

	useEffect(() => {
		let mounted = true;
		void window.search.getSettings().then(
			(next) => {
				if (!mounted) return;
				setSearchSettings(next);
				setSearchEngineError(null);
			},
			(error) => {
				if (!mounted) return;
				setSearchEngineError(firstErrorMessage(error, t('settings.searchEngine.errors.load')));
			}
		);
		return () => {
			mounted = false;
		};
	}, [t]);

	const handleSearchEngineChange = (value: SearchEngineId | null): void => {
		if (!value) return;
		setSearchSavingEngineId(value);
		setSearchEngineError(null);
		void window.search
			.selectEngine(value)
			.then(
				(next) => {
					setSearchSettings(next);
				},
				(error) => {
					setSearchEngineError(firstErrorMessage(error, t('settings.searchEngine.errors.select')));
				}
			)
			.finally(() => {
				setSearchSavingEngineId(null);
			});
	};

	return (
		<SettingsPageShell>
			<SettingsPageHeader
				title={t('settings.modelServices.tools')}
				description={t('settings.modelServices.toolsDescription')}
			/>

			<SettingsPanel>
				<AgentMediaModelConfiguration
					api={TOOL_IMAGE_API}
					capability="text-to-image"
					idPrefix="agent-image"
					title={t('settings.modelServices.imageAssistantName')}
					description={t('settings.modelServices.imageModelDescription')}
					showIcon
					icon={ImageIcon}
					showFieldLabel={false}
					grouped
					showSelectedModel
					buttonDropdown
					showContentSeparator={false}
					inlineAdvanced
				/>

				<AgentMediaModelConfiguration
					api={TOOL_AUDIO_API}
					capability="text-to-audio"
					idPrefix="agent-audio"
					title={t('settings.modelServices.musicCreatorName')}
					description={t('settings.modelServices.musicModelDescription')}
					showIcon
					icon={Music2}
					showFieldLabel={false}
					grouped
					showSelectedModel
					buttonDropdown
					showContentSeparator={false}
					inlineAdvanced
				/>

				<AgentMediaModelConfiguration
					api={TOOL_VIDEO_API}
					capability="text-to-video"
					idPrefix="agent-video"
					title={t('settings.modelServices.videoCreatorName')}
					description={t('settings.modelServices.videoModelDescription')}
					showIcon
					icon={Video}
					showFieldLabel={false}
					grouped
					showSelectedModel
					buttonDropdown
					showContentSeparator={false}
					inlineAdvanced
				/>

				<AgentMediaModelConfiguration
					api={TOOL_TEXT_TO_SPEECH_API}
					capability="text-to-speech"
					idPrefix="agent-tool-text-to-speech"
					title={t('settings.modelServices.toolTextToSpeechName')}
					description={t('settings.modelServices.toolTextToSpeechDescription')}
					showIcon
					icon={Volume2}
					showFieldLabel={false}
					grouped
					showSelectedModel
					buttonDropdown
					showContentSeparator={false}
					inlineAdvanced
				/>

				<AgentMediaModelConfiguration
					api={TOOL_SPEECH_TO_TEXT_API}
					capability="speech-to-text"
					idPrefix="agent-tool-speech-to-text"
					title={t('settings.modelServices.toolSpeechToTextName')}
					description={t('settings.modelServices.toolSpeechToTextDescription')}
					showIcon
					icon={Mic}
					showFieldLabel={false}
					grouped
					showSelectedModel
					buttonDropdown
					showContentSeparator={false}
					showOptions={false}
				/>

				<Collapsible className="min-w-0 max-w-full overflow-hidden">
					<div className="flex w-full items-center gap-3 px-4 py-3.5 transition-colors hover:bg-muted/40">
						<CollapsibleTrigger className="flex min-w-0 flex-1 items-center gap-4 text-left">
							<SearchIcon className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
							<div className="min-w-0 flex-1">
								<div className="truncate text-[13px] font-medium leading-4 text-foreground">
									{t('settings.tabs.searchEngine')}
								</div>
								<p className="mt-0.5 truncate text-[11px] leading-4 text-muted-foreground">
									{selectedSearchEngineDescription}
								</p>
							</div>
						</CollapsibleTrigger>
						<div className="shrink-0">
							<Select
								value={searchSettings?.engineId ?? null}
								onValueChange={handleSearchEngineChange}
								disabled={!searchSettings || searchSavingEngineId !== null}
							>
								<SelectTrigger
									className="w-40 max-w-full text-xs [&_svg]:size-3"
									aria-label={t('settings.tabs.searchEngine')}
								>
									<SelectValue placeholder={t('settings.searchEngine.defaultTitle')}>
										{selectedSearchEngine?.name}
									</SelectValue>
								</SelectTrigger>
								<SelectContent>
									{SEARCH_ENGINES.map((engine) => (
										<SelectItem
											key={engine.id}
											value={engine.id}
											disabled={!searchSettings?.configured[engine.id]}
										>
											{engine.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
					</div>
					<CollapsibleContent>
						{searchEngineError && (
							<SettingsNotice variant="destructive" icon={AlertTriangle} className="mx-3 mt-3">
								{searchEngineError}
							</SettingsNotice>
						)}
					</CollapsibleContent>
				</Collapsible>
			</SettingsPanel>
		</SettingsPageShell>
	);
};

export default ToolsPage;
