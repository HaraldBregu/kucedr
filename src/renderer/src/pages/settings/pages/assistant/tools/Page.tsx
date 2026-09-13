import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
	AppWindow,
	AlertTriangle,
	BookOpen,
	Brain,
	FileText,
	Globe,
	Image as ImageIcon,
	ListTodo,
	Mic,
	Monitor,
	Music2,
	Network,
	Search as SearchIcon,
	Settings,
	Sparkles,
	Target,
	Terminal,
	Video,
	Volume2,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
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

type AgentTool = readonly [name: string, id: string, description: string];

type AgentToolGroup = {
	readonly titleKey: string;
	readonly icon: LucideIcon;
	readonly tools: readonly AgentTool[];
};

type FileToolsPermission = 'ask' | 'allow' | 'deny';

const AGENT_TOOL_GROUPS: readonly AgentToolGroup[] = [
	{
		titleKey: 'coordination',
		icon: Network,
		tools: [
			[
				'List remote agents',
				'list_a2a_agents',
				'Lists connected remote agents that can accept delegated work.',
			],
			['Delegate to remote agent', 'delegate_a2a', 'Sends a task to a connected remote agent.'],
			['Get remote task', 'get_a2a_task', 'Checks the status and result of a delegated task.'],
			['Cancel remote task', 'cancel_a2a_task', 'Cancels a delegated task that is still running.'],
			['Subagent', 'subagent', 'Starts one subagent for a focused task.'],
			['Subagents', 'subagents', 'Starts multiple subagents for independent tasks.'],
		],
	},
	{
		titleKey: 'files',
		icon: FileText,
		tools: [
			['Read file', 'read', 'Reads file contents from the workspace.'],
			['Write file', 'write', 'Creates or replaces a file in the workspace.'],
			['Edit file', 'edit', 'Makes a targeted text edit to an existing file.'],
			['Apply patch', 'patch', 'Applies a structured patch to one or more files.'],
			['Undo file operation', 'undo', 'Reverts the most recent tracked file operation.'],
			['Redo file operation', 'redo', 'Reapplies a previously undone file operation.'],
		],
	},
	{
		titleKey: 'commands',
		icon: Terminal,
		tools: [
			['Execute command', 'bash', 'Runs a shell command in the workspace.'],
			['Manage process', 'process', 'Inspects, waits for, or stops managed processes.'],
		],
	},
	{
		titleKey: 'web',
		icon: Globe,
		tools: [
			['Fetch web page', 'fetch_web_page', 'Retrieves and reads a web page by URL.'],
			[
				'Use web browser',
				'use_web_browser',
				'Controls a browser to navigate and interact with websites.',
			],
		],
	},
	{
		titleKey: 'media',
		icon: ImageIcon,
		tools: [
			['Create image', 'create_image', 'Generates or edits an image from instructions.'],
			['Create video', 'create_video', 'Generates a video from instructions.'],
			['Create sound', 'create_sound', 'Generates audio or music from instructions.'],
			['Text to speech', 'text_to_speech', 'Converts text into spoken audio.'],
			['Speech to text', 'speech_to_text', 'Transcribes speech from an audio input.'],
		],
	},
	{
		titleKey: 'recording',
		icon: Monitor,
		tools: [
			['Microphone recorder', 'microphone_recorder', 'Starts recording microphone audio.'],
			[
				'Microphone recorder status',
				'microphone_recorder_status',
				'Reports the state of a microphone recording.',
			],
			[
				'Microphone recorder stop',
				'microphone_recorder_stop',
				'Stops a microphone recording and returns the audio.',
			],
			['Camera recorder', 'camera_recorder', 'Starts recording from a camera.'],
			[
				'Camera recorder status',
				'camera_recorder_status',
				'Reports the state of a camera recording.',
			],
			[
				'Camera recorder stop',
				'camera_recorder_stop',
				'Stops a camera recording and returns the video.',
			],
			['Screen recorder', 'screen_recorder', 'Starts recording a selected screen or window.'],
			[
				'Select screen source',
				'select_screen_source',
				'Lets the user choose the screen or window to record.',
			],
			[
				'Screen recorder status',
				'screen_recorder_status',
				'Reports the state of a screen recording.',
			],
			[
				'Screen recorder stop',
				'screen_recorder_stop',
				'Stops a screen recording and returns the video.',
			],
		],
	},
	{
		titleKey: 'knowledge',
		icon: BookOpen,
		tools: [
			[
				'Query knowledge',
				'query_knowledge',
				'Searches the selected knowledge base for relevant content.',
			],
		],
	},
	{
		titleKey: 'memory',
		icon: Brain,
		tools: [
			['Save memory', 'save_memory', 'Saves a durable memory for future conversations.'],
			['Forget memory', 'forget_memory', 'Removes a saved memory.'],
			['List memories', 'list_memories', 'Lists memories available to the agent.'],
		],
	},
	{
		titleKey: 'tasks',
		icon: ListTodo,
		tools: [
			['Create task', 'create_task', 'Creates a scheduled background task.'],
			['Update task', 'update_task', 'Changes an existing scheduled task.'],
			['Pause task', 'pause_task', 'Pauses a scheduled task.'],
			['Resume task', 'resume_task', 'Resumes a paused scheduled task.'],
			['Delete task', 'delete_task', 'Permanently removes a scheduled task.'],
			['Get task', 'get_task', 'Reads the details of a scheduled task.'],
			['List tasks', 'list_tasks', 'Lists scheduled tasks.'],
			['Run task now', 'run_task_now', 'Runs a scheduled task immediately.'],
		],
	},
	{
		titleKey: 'apps',
		icon: AppWindow,
		tools: [
			['List apps', 'list_apps', 'Lists installed apps available to the agent.'],
			['Open apps', 'open_apps', 'Opens an installed app.'],
			['Close apps', 'close_apps', 'Closes an open app.'],
		],
	},
	{
		titleKey: 'skills',
		icon: Sparkles,
		tools: [
			['List skills', 'list_skills', 'Lists skills that can extend the current run.'],
			['Load skill', 'load_skill', 'Loads a skill and its allowed tools for the current run.'],
		],
	},
	{
		titleKey: 'goals',
		icon: Target,
		tools: [
			['Get goal', 'get_goal', 'Reads the active goal, plan, criteria, and evidence.'],
			['Update goal plan', 'update_goal_plan', 'Updates the steps for an active goal.'],
			[
				'Record goal evidence',
				'record_goal_evidence',
				'Records evidence that a goal criterion is satisfied.',
			],
			[
				'Request goal completion',
				'request_goal_completion',
				'Requests completion after every goal criterion has evidence.',
			],
			[
				'Report goal blocker',
				'report_goal_blocker',
				'Marks an active goal as blocked with its reason.',
			],
		],
	},
	{
		titleKey: 'system',
		icon: Settings,
		tools: [
			['Request user input', 'ask', 'Asks the user for information needed to continue.'],
			['Update health', 'update_health', 'Updates the agent health status.'],
			['Update health settings', 'update_health_settings', 'Changes the agent health settings.'],
			['Complete bootstrap', 'complete_bootstrap', 'Marks initial agent setup as complete.'],
		],
	},
] as const;

const ORDERED_AGENT_TOOL_GROUPS = [
	'files',
	'commands',
	'web',
	'media',
	'recording',
	'knowledge',
	'memory',
	'skills',
	'tasks',
	'apps',
	'coordination',
	'goals',
	'system',
].map((titleKey) => AGENT_TOOL_GROUPS.find((group) => group.titleKey === titleKey)!);

const ToolsPage: React.FC = () => {
	const { t } = useTranslation();
	const [searchSettings, setSearchSettings] = useState<SearchSettings | null>(null);
	const [searchEngineError, setSearchEngineError] = useState<string | null>(null);
	const [searchSavingEngineId, setSearchSavingEngineId] = useState<SearchEngineId | null>(null);
	const [permissions, setPermissions] = useState<Awaited<
		ReturnType<typeof window.agent.policyGet>
	> | null>(null);
	const [fileToolsSaving, setFileToolsSaving] = useState(false);
	const [fileToolsError, setFileToolsError] = useState<string | null>(null);
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

	useEffect(() => {
		void window.agent.policyGet().then(setPermissions, (error) => {
			setFileToolsError(firstErrorMessage(error, t('settings.modelServices.loadError')));
		});
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

	const handleFileToolsPermissionChange = (
		toolId: string,
		settings: { enabled: boolean; permission: FileToolsPermission }
	): void => {
		if (!permissions || fileToolsSaving) return;
		const next = { ...permissions, tools: { ...permissions.tools, [toolId]: settings } };
		setPermissions(next);
		setFileToolsSaving(true);
		setFileToolsError(null);
		void window.agent
			.policySet(next)
			.then(setPermissions, (error) => {
				setFileToolsError(firstErrorMessage(error, t('settings.modelServices.saveError')));
				setPermissions(permissions);
			})
			.finally(() => {
				setFileToolsSaving(false);
			});
	};

	return (
		<SettingsPageShell>
			<SettingsPageHeader
				title={t('settings.modelServices.tools')}
				description={t('settings.modelServices.toolsDescription')}
			/>

			<SettingsSection
				title={t('settings.modelServices.agentTools.groups.media')}
				className="order-2"
			>
				<SettingsPanel>
					<AgentMediaModelConfiguration
						api={TOOL_IMAGE_API}
						capability="text-to-image"
						idPrefix="agent-image"
						title={t('settings.modelServices.imageAssistantName')}
						description={t('settings.modelServices.imageModelDescription')}
						showIcon
						icon={ImageIcon}
						grouped
						showContentSeparator={false}
						inlineAdvanced
						action={<>
							<Select
								value={permissions?.tools?.create_image?.permission ?? 'allow'}
								onValueChange={(permission) => handleFileToolsPermissionChange('create_image', {
									...(permissions?.tools?.create_image ?? { enabled: true, permission: 'allow' }),
									permission: permission as FileToolsPermission,
								})}
								disabled={!permissions || fileToolsSaving}
							>
								<SelectTrigger size="sm" className="w-24 text-xs [&_svg]:size-3" aria-label={`${t('settings.modelServices.agentTools.filePermissionLabel')}: Text to image`}>
									<SelectValue />
								</SelectTrigger>
								<SelectContent><SelectItem value="ask">{t('settings.modelServices.agentTools.permissions.ask')}</SelectItem><SelectItem value="allow">{t('settings.modelServices.agentTools.permissions.allow')}</SelectItem><SelectItem value="deny">{t('settings.modelServices.agentTools.permissions.deny')}</SelectItem></SelectContent>
							</Select>
							<Switch
								checked={permissions?.tools?.create_image?.enabled ?? true}
								onCheckedChange={(enabled) =>
									handleFileToolsPermissionChange('create_image', {
																...(permissions?.tools?.create_image ?? { enabled: true, permission: 'allow' }),
										enabled,
									})
								}
								aria-label="Text to image enabled"
								disabled={!permissions || fileToolsSaving}
							/>
						</>}
					/>

					<AgentMediaModelConfiguration
						api={TOOL_AUDIO_API}
						capability="text-to-audio"
						idPrefix="agent-audio"
						title={t('settings.modelServices.musicCreatorName')}
						description={t('settings.modelServices.musicModelDescription')}
						showIcon
						icon={Music2}
						grouped
						showContentSeparator={false}
						inlineAdvanced
						action={<>
							<Select
								value={permissions?.tools?.create_sound?.permission ?? 'allow'}
								onValueChange={(permission) => handleFileToolsPermissionChange('create_sound', {
									...(permissions?.tools?.create_sound ?? { enabled: true, permission: 'allow' }),
									permission: permission as FileToolsPermission,
								})}
								disabled={!permissions || fileToolsSaving}
							>
								<SelectTrigger size="sm" className="w-24 text-xs [&_svg]:size-3" aria-label={`${t('settings.modelServices.agentTools.filePermissionLabel')}: Text to audio`}>
									<SelectValue />
								</SelectTrigger>
								<SelectContent><SelectItem value="ask">{t('settings.modelServices.agentTools.permissions.ask')}</SelectItem><SelectItem value="allow">{t('settings.modelServices.agentTools.permissions.allow')}</SelectItem><SelectItem value="deny">{t('settings.modelServices.agentTools.permissions.deny')}</SelectItem></SelectContent>
							</Select>
							<Switch
								checked={permissions?.tools?.create_sound?.enabled ?? true}
								onCheckedChange={(enabled) =>
									handleFileToolsPermissionChange('create_sound', {
																...(permissions?.tools?.create_sound ?? { enabled: true, permission: 'allow' }),
										enabled,
									})
								}
								aria-label="Text to audio enabled"
								disabled={!permissions || fileToolsSaving}
							/>
						</>}
					/>

					<AgentMediaModelConfiguration
						api={TOOL_VIDEO_API}
						capability="text-to-video"
						idPrefix="agent-video"
						title={t('settings.modelServices.videoCreatorName')}
						description={t('settings.modelServices.videoModelDescription')}
						showIcon
						icon={Video}
						grouped
						showContentSeparator={false}
						inlineAdvanced
						action={<>
							<Select
								value={permissions?.tools?.create_video?.permission ?? 'allow'}
								onValueChange={(permission) => handleFileToolsPermissionChange('create_video', {
									...(permissions?.tools?.create_video ?? { enabled: true, permission: 'allow' }),
									permission: permission as FileToolsPermission,
								})}
								disabled={!permissions || fileToolsSaving}
							>
								<SelectTrigger size="sm" className="w-24 text-xs [&_svg]:size-3" aria-label={`${t('settings.modelServices.agentTools.filePermissionLabel')}: Text to video`}>
									<SelectValue />
								</SelectTrigger>
								<SelectContent><SelectItem value="ask">{t('settings.modelServices.agentTools.permissions.ask')}</SelectItem><SelectItem value="allow">{t('settings.modelServices.agentTools.permissions.allow')}</SelectItem><SelectItem value="deny">{t('settings.modelServices.agentTools.permissions.deny')}</SelectItem></SelectContent>
							</Select>
							<Switch
								checked={permissions?.tools?.create_video?.enabled ?? true}
								onCheckedChange={(enabled) =>
									handleFileToolsPermissionChange('create_video', {
																...(permissions?.tools?.create_video ?? { enabled: true, permission: 'allow' }),
										enabled,
									})
								}
								aria-label="Text to video enabled"
								disabled={!permissions || fileToolsSaving}
							/>
						</>}
					/>

					<AgentMediaModelConfiguration
						api={TOOL_TEXT_TO_SPEECH_API}
						capability="text-to-speech"
						idPrefix="agent-tool-text-to-speech"
						title={t('settings.modelServices.toolTextToSpeechName')}
						description={t('settings.modelServices.toolTextToSpeechDescription')}
						showIcon
						icon={Volume2}
						grouped
						showContentSeparator={false}
						inlineAdvanced
						action={<>
							<Select
								value={permissions?.tools?.text_to_speech?.permission ?? 'allow'}
								onValueChange={(permission) => handleFileToolsPermissionChange('text_to_speech', {
									...(permissions?.tools?.text_to_speech ?? { enabled: true, permission: 'allow' }),
									permission: permission as FileToolsPermission,
								})}
								disabled={!permissions || fileToolsSaving}
							>
								<SelectTrigger size="sm" className="w-24 text-xs [&_svg]:size-3" aria-label={`${t('settings.modelServices.agentTools.filePermissionLabel')}: Text to speech`}>
									<SelectValue />
								</SelectTrigger>
								<SelectContent><SelectItem value="ask">{t('settings.modelServices.agentTools.permissions.ask')}</SelectItem><SelectItem value="allow">{t('settings.modelServices.agentTools.permissions.allow')}</SelectItem><SelectItem value="deny">{t('settings.modelServices.agentTools.permissions.deny')}</SelectItem></SelectContent>
							</Select>
							<Switch
								checked={permissions?.tools?.text_to_speech?.enabled ?? true}
								onCheckedChange={(enabled) =>
									handleFileToolsPermissionChange('text_to_speech', {
																...(permissions?.tools?.text_to_speech ?? { enabled: true, permission: 'allow' }),
										enabled,
									})
								}
								aria-label="Text to speech enabled"
								disabled={!permissions || fileToolsSaving}
							/>
						</>}
					/>

					<AgentMediaModelConfiguration
						api={TOOL_SPEECH_TO_TEXT_API}
						capability="speech-to-text"
						idPrefix="agent-tool-speech-to-text"
						title={t('settings.modelServices.toolSpeechToTextName')}
						description={t('settings.modelServices.toolSpeechToTextDescription')}
						showIcon
						icon={Mic}
						grouped
						showContentSeparator={false}
						showOptions={false}
						action={<>
							<Select
								value={permissions?.tools?.speech_to_text?.permission ?? 'allow'}
								onValueChange={(permission) => handleFileToolsPermissionChange('speech_to_text', {
									...(permissions?.tools?.speech_to_text ?? { enabled: true, permission: 'allow' }),
									permission: permission as FileToolsPermission,
								})}
								disabled={!permissions || fileToolsSaving}
							>
								<SelectTrigger size="sm" className="w-24 text-xs [&_svg]:size-3" aria-label={`${t('settings.modelServices.agentTools.filePermissionLabel')}: Speech to text`}>
									<SelectValue />
								</SelectTrigger>
								<SelectContent><SelectItem value="ask">{t('settings.modelServices.agentTools.permissions.ask')}</SelectItem><SelectItem value="allow">{t('settings.modelServices.agentTools.permissions.allow')}</SelectItem><SelectItem value="deny">{t('settings.modelServices.agentTools.permissions.deny')}</SelectItem></SelectContent>
							</Select>
							<Switch
								checked={permissions?.tools?.speech_to_text?.enabled ?? true}
								onCheckedChange={(enabled) =>
									handleFileToolsPermissionChange('speech_to_text', {
																...(permissions?.tools?.speech_to_text ?? { enabled: true, permission: 'allow' }),
										enabled,
									})
								}
								aria-label="Speech to text enabled"
								disabled={!permissions || fileToolsSaving}
							/>
						</>}
					/>
				</SettingsPanel>
			</SettingsSection>

			{ORDERED_AGENT_TOOL_GROUPS.filter((group) => group.titleKey !== 'media').map((group) => {
				const Icon = group.icon;
				return (
					<SettingsSection
						key={group.titleKey}
						title={t(`settings.modelServices.agentTools.groups.${group.titleKey}`)}
					>
						<SettingsPanel>
							{group.titleKey === 'web' && (
								<Collapsible className="min-w-0 max-w-full overflow-hidden border-b border-border/60">
									<div className="flex w-full items-center gap-3 px-4 py-3.5 transition-colors hover:bg-muted/40">
										<CollapsibleTrigger className="flex min-w-0 flex-1 items-center gap-4 text-left">
											<SearchIcon className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
											<div className="min-w-0 flex-1">
												<div className="truncate text-[13px] font-medium leading-4 text-foreground">
													Search web
												</div>
												<p className="mt-0.5 truncate text-[11px] leading-4 text-muted-foreground">
													{selectedSearchEngineDescription}
												</p>
											</div>
										</CollapsibleTrigger>
										<Select
											value={permissions?.tools?.search_web?.permission ?? 'allow'}
											onValueChange={(value) =>
												handleFileToolsPermissionChange('search_web', {
													...(permissions?.tools?.search_web ?? { enabled: true, permission: 'allow' }),
													permission: value as FileToolsPermission,
												})
											}
											disabled={!permissions || fileToolsSaving}
										>
											<SelectTrigger
												size="sm"
												className="w-24 text-xs [&_svg]:size-3"
												aria-label={`${t('settings.modelServices.agentTools.filePermissionLabel')}: Search web`}
											>
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="ask">
													{t('settings.modelServices.agentTools.permissions.ask')}
												</SelectItem>
												<SelectItem value="allow">
													{t('settings.modelServices.agentTools.permissions.allow')}
												</SelectItem>
												<SelectItem value="deny">
													{t('settings.modelServices.agentTools.permissions.deny')}
												</SelectItem>
											</SelectContent>
										</Select>
										<Switch
											checked={permissions?.tools?.search_web?.enabled ?? true}
											onCheckedChange={(enabled) =>
												handleFileToolsPermissionChange('search_web', {
													...(permissions?.tools?.search_web ?? { enabled: true, permission: 'allow' }),
													enabled,
												})
											}
											aria-label="Search web enabled"
											disabled={!permissions || fileToolsSaving}
										/>
									</div>
									<CollapsibleContent>
										<div className="border-t border-border/60">
											<SettingsRow
												title={t('settings.searchEngine.defaultTitle')}
												description={t('settings.searchEngine.defaultDescription')}
												actions={
													<Select
														value={searchSettings?.engineId ?? null}
														onValueChange={handleSearchEngineChange}
														disabled={!searchSettings || searchSavingEngineId !== null}
													>
														<SelectTrigger
															className="w-40 max-w-full text-xs [&_svg]:size-3"
															aria-label="Search web"
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
												}
											/>
										</div>
										{searchEngineError && (
											<SettingsNotice variant="destructive" icon={AlertTriangle} className="mx-3 mt-3">
												{searchEngineError}
											</SettingsNotice>
										)}
									</CollapsibleContent>
								</Collapsible>
							)}
							{group.tools.map(([name, id, description]) => {
								const settings = permissions?.tools?.[id] ?? { enabled: true, permission: 'allow' };
								return (
									<SettingsRow
										key={id}
										title={name}
										media={
											<Icon className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
										}
										description={
											<>
												{description} <code className="text-[11px]">{id}</code>
											</>
										}
										actions={
											<>
												<Select
													value={settings.permission}
													onValueChange={(value) =>
														handleFileToolsPermissionChange(id, {
															...settings,
															permission: value as FileToolsPermission,
														})
													}
													disabled={!permissions || fileToolsSaving}
												>
													<SelectTrigger
														size="sm"
														className="w-24 text-xs [&_svg]:size-3"
														aria-label={`${t('settings.modelServices.agentTools.filePermissionLabel')}: ${name}`}
													>
														<SelectValue />
													</SelectTrigger>
													<SelectContent>
														<SelectItem value="ask">
															{t('settings.modelServices.agentTools.permissions.ask')}
														</SelectItem>
														<SelectItem value="allow">
															{t('settings.modelServices.agentTools.permissions.allow')}
														</SelectItem>
														<SelectItem value="deny">
															{t('settings.modelServices.agentTools.permissions.deny')}
														</SelectItem>
													</SelectContent>
												</Select>
												<Switch
													checked={settings.enabled}
													onCheckedChange={(enabled) =>
														handleFileToolsPermissionChange(id, { ...settings, enabled })
													}
													disabled={!permissions || fileToolsSaving}
													aria-label={`${name} enabled`}
												/>
											</>
										}
									/>
								);
							})}
						</SettingsPanel>
						{group.titleKey === 'files' && fileToolsError && (
							<SettingsNotice variant="destructive" icon={AlertTriangle}>
								{fileToolsError}
							</SettingsNotice>
						)}
					</SettingsSection>
				);
			})}
		</SettingsPageShell>
	);
};

export default ToolsPage;
