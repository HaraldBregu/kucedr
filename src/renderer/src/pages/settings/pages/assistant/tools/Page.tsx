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
	SettingsRow,
	SettingsSection,
} from '../../../components';
import { firstErrorMessage } from '../../../components/model-configuration-state';
import { SEARCH_ENGINES } from '../../search/catalog';
import type { SearchEngineId, SearchSettings } from '../../../../../../../shared/search_types';
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

const AGENT_TOOL_GROUPS = [
	{
		title: 'Agent coordination',
		tools: [
			['List remote agents', 'list_a2a_agents'],
			['Delegate to remote agent', 'delegate_a2a'],
			['Get remote task', 'get_a2a_task'],
			['Cancel remote task', 'cancel_a2a_task'],
			['Subagent', 'subagent'],
			['Subagents', 'subagents'],
		],
	},
	{
		title: 'Workspace',
		tools: [
			['Read file', 'read'],
			['Write file', 'write'],
			['Edit file', 'edit'],
			['Apply patch', 'patch'],
			['Execute command', 'bash'],
			['Manage process', 'process'],
			['Undo file operation', 'undo'],
			['Redo file operation', 'redo'],
		],
	},
	{
		title: 'Web',
		tools: [
			['Search web', 'search_web'],
			['Fetch web page', 'fetch_web_page'],
			['Use web browser', 'use_web_browser'],
		],
	},
	{
		title: 'Media',
		tools: [
			['Create image', 'create_image'],
			['Create video', 'create_video'],
			['Create sound', 'create_sound'],
			['Text to speech', 'text_to_speech'],
			['Speech to text', 'speech_to_text'],
		],
	},
	{
		title: 'Recording',
		tools: [
			['Microphone recorder', 'microphone_recorder'],
			['Microphone recorder status', 'microphone_recorder_status'],
			['Microphone recorder stop', 'microphone_recorder_stop'],
			['Camera recorder', 'camera_recorder'],
			['Camera recorder status', 'camera_recorder_status'],
			['Camera recorder stop', 'camera_recorder_stop'],
			['Screen recorder', 'screen_recorder'],
			['Select screen source', 'select_screen_source'],
			['Screen recorder status', 'screen_recorder_status'],
			['Screen recorder stop', 'screen_recorder_stop'],
		],
	},
	{
		title: 'Knowledge and memory',
		tools: [
			['Query knowledge', 'query_knowledge'],
			['Save memory', 'save_memory'],
			['Forget memory', 'forget_memory'],
			['List memories', 'list_memories'],
		],
	},
	{
		title: 'Tasks and apps',
		tools: [
			['Create task', 'create_task'],
			['Update task', 'update_task'],
			['Pause task', 'pause_task'],
			['Resume task', 'resume_task'],
			['Delete task', 'delete_task'],
			['Get task', 'get_task'],
			['List tasks', 'list_tasks'],
			['Run task now', 'run_task_now'],
			['List apps', 'list_apps'],
			['Open apps', 'open_apps'],
			['Close apps', 'close_apps'],
		],
	},
	{
		title: 'Skills, goals, and setup',
		tools: [
			['List skills', 'list_skills'],
			['Load skill', 'load_skill'],
			['Get goal', 'get_goal'],
			['Update goal plan', 'update_goal_plan'],
			['Record goal evidence', 'record_goal_evidence'],
			['Request goal completion', 'request_goal_completion'],
			['Report goal blocker', 'report_goal_blocker'],
			['Request user input', 'ask'],
			['Update health', 'update_health'],
			['Update health settings', 'update_health_settings'],
			['Complete bootstrap', 'complete_bootstrap'],
		],
	},
] as const;

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

			<SettingsSection
				title="Agent tools"
				description="Built-in capabilities available to agents. Availability can vary by run mode, permissions, and configuration. Installed MCP servers add their own tools dynamically."
			>
				<SettingsPanel>
					{AGENT_TOOL_GROUPS.map((group) => (
						<div key={group.title}>
							<div className="border-b border-border/60 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
								{group.title}
							</div>
							{group.tools.map((tool) => {
								const [name, id] = tool;
								return (
								<SettingsRow
									key={id}
									title={name}
									description={<code className="text-[11px]">{id}</code>}
								/>
								);
							})}
						</div>
					))}
				</SettingsPanel>
			</SettingsSection>
		</SettingsPageShell>
	);
};

export default ToolsPage;
