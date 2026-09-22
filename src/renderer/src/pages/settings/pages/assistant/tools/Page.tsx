import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
	AlertTriangle,
	BookOpen,
	FileText,
	Globe,
	Image as ImageIcon,
	ListTodo,
	Monitor,
	Music2,
	Network,
	Search as SearchIcon,
	Settings,
	Sparkles,
	Target,
	Terminal,
	Video,
	X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
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
import type {
	AgentToolConfiguration,
	AgentToolProfile,
	AgentToolProfileId,
	AgentToolReference,
} from '../../../../../../../shared/agent_tools';
import { isAgentToolAllowedForProfile } from '../../../../../../../shared/agent_tools';
import { ToolPermissionControl } from './Permission';

type AgentTool = readonly [name: string, id: string, description: string];

type AgentToolGroup = {
	readonly titleKey: string;
	readonly icon: LucideIcon;
	readonly tools: readonly AgentTool[];
};

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
		titleKey: 'tasks',
		icon: ListTodo,
		tools: [
			['Create task', 'create_task', 'Creates a scheduled background task.'],
			['Update task', 'update_task', 'Changes an existing scheduled task.'],
			['Delete task', 'delete_task', 'Permanently removes a scheduled task.'],
			['List tasks', 'list_tasks', 'Lists scheduled tasks.'],
			['Run task now', 'run_task_now', 'Runs a scheduled task immediately.'],
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
	'skills',
	'tasks',
	'coordination',
	'goals',
	'system',
].map((titleKey) => AGENT_TOOL_GROUPS.find((group) => group.titleKey === titleKey)!);

const ToolsPage: React.FC<{ profile?: AgentToolProfileId }> = ({ profile = 'chat' }) => {
	const { t } = useTranslation();
	const [toolSearch, setToolSearch] = useState('');
	const [searchSettings, setSearchSettings] = useState<SearchSettings | null>(null);
	const [searchEngineError, setSearchEngineError] = useState<string | null>(null);
	const [searchSavingEngineId, setSearchSavingEngineId] = useState<SearchEngineId | null>(null);
	const [toolProfile, setToolProfile] = useState<AgentToolProfile | null>(null);
	const [fileToolsSaving, setFileToolsSaving] = useState(false);
	const [fileToolsError, setFileToolsError] = useState<string | null>(null);
	const selectedSearchEngine = SEARCH_ENGINES.find(
		(engine) => engine.id === searchSettings?.engineId
	);
	const selectedSearchEngineDescription = selectedSearchEngine
		? t(selectedSearchEngine.descriptionKey)
		: t('settings.searchEngine.defaultDescription');
	const normalizedToolSearch = toolSearch.trim().toLocaleLowerCase();
	const filteredToolGroups = ORDERED_AGENT_TOOL_GROUPS.map((group) => ({
		...group,
		tools: group.tools.filter(
			([name, id, description]) =>
				isAgentToolAllowedForProfile(profile, { kind: 'builtin', id }) &&
				[name, id, description, t(`settings.modelServices.agentTools.groups.${group.titleKey}`)]
					.join(' ')
					.toLocaleLowerCase()
					.includes(normalizedToolSearch)
		),
	}));
	const mediaSearchText = [
		t('settings.modelServices.agentTools.groups.media'),
		t('settings.modelServices.imageAssistantName'),
		t('settings.modelServices.imageModelDescription'),
		t('settings.modelServices.musicCreatorName'),
		t('settings.modelServices.musicModelDescription'),
		t('settings.modelServices.videoCreatorName'),
		t('settings.modelServices.videoModelDescription'),
		'create_image create_sound create_video',
	]
		.join(' ')
		.toLocaleLowerCase();

	useEffect(() => {
		if (profile !== 'chat') return;
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
	}, [profile, t]);

	useEffect(() => {
		void window.agent.getToolProfile(profile).then(setToolProfile, (error) => {
			setFileToolsError(firstErrorMessage(error, t('settings.modelServices.loadError')));
		});
	}, [profile, t]);

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

	const updateProfileTool = (tool: AgentToolReference, settings: AgentToolConfiguration): void => {
		if (!toolProfile || fileToolsSaving) return;
		setFileToolsSaving(true);
		setFileToolsError(null);
		void window.agent
			.setToolProfileTool(profile, tool, settings)
			.then(setToolProfile, (error) => {
				setFileToolsError(firstErrorMessage(error, t('settings.modelServices.saveError')));
			})
			.finally(() => setFileToolsSaving(false));
	};

	const handleFileToolsPermissionChange = (
		toolId: string,
		settings: AgentToolConfiguration
	): void => {
		updateProfileTool({ kind: 'builtin', id: toolId }, settings);
	};

	return (
		<SettingsPageShell>
			<SettingsPageHeader
				title={t('settings.modelServices.tools')}
				description={t('settings.modelServices.toolsDescription')}
			/>
			<div className="relative">
				<Input
					type="text"
					value={toolSearch}
					onChange={(event) => setToolSearch(event.target.value)}
					placeholder={t('settings.modelServices.agentTools.searchPlaceholder')}
					aria-label={t('settings.modelServices.agentTools.searchPlaceholder')}
					className="pr-10"
				/>
				{toolSearch && (
					<Button
						type="button"
						variant="ghost"
						size="icon-sm"
						className="absolute right-1.5 top-1.5 text-muted-foreground"
						onClick={() => setToolSearch('')}
						aria-label={t('settings.modelServices.agentTools.clearSearch')}
					>
						<X aria-hidden="true" />
					</Button>
				)}
			</div>

			{profile !== 'health' && mediaSearchText.includes(normalizedToolSearch) && (
				<SettingsSection
					title={t('settings.modelServices.agentTools.groups.media')}
					className="order-2"
				>
					<SettingsPanel>
						<SettingsRow
							title={t('settings.modelServices.imageAssistantName')}
							description={t('settings.modelServices.imageModelDescription')}
							icon={ImageIcon}
							actions={
								<ToolPermissionControl
									name={t('settings.modelServices.imageAssistantName')}
									value={toolProfile?.tools?.create_image?.permission ?? 'allow'}
									disabled={!toolProfile || fileToolsSaving}
									onChange={(permission) =>
										handleFileToolsPermissionChange('create_image', { permission })
									}
								/>
							}
						/>

						<SettingsRow
							title={t('settings.modelServices.musicCreatorName')}
							description={t('settings.modelServices.musicModelDescription')}
							icon={Music2}
							actions={
								<ToolPermissionControl
									name={t('settings.modelServices.musicCreatorName')}
									value={toolProfile?.tools?.create_sound?.permission ?? 'allow'}
									disabled={!toolProfile || fileToolsSaving}
									onChange={(permission) =>
										handleFileToolsPermissionChange('create_sound', { permission })
									}
								/>
							}
						/>

						<SettingsRow
							title={t('settings.modelServices.videoCreatorName')}
							description={t('settings.modelServices.videoModelDescription')}
							icon={Video}
							actions={
								<ToolPermissionControl
									name={t('settings.modelServices.videoCreatorName')}
									value={toolProfile?.tools?.create_video?.permission ?? 'allow'}
									disabled={!toolProfile || fileToolsSaving}
									onChange={(permission) =>
										handleFileToolsPermissionChange('create_video', { permission })
									}
								/>
							}
						/>
					</SettingsPanel>
				</SettingsSection>
			)}

			{filteredToolGroups
				.filter(
					(group) =>
						group.titleKey !== 'media' &&
						(group.tools.length > 0 ||
							(profile !== 'health' &&
								group.titleKey === 'web' &&
								'search web search_web'.includes(normalizedToolSearch)))
				)
				.map((group) => {
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
												<SearchIcon
													className="size-5 shrink-0 text-muted-foreground"
													aria-hidden="true"
												/>
												<div className="min-w-0 flex-1">
													<div className="truncate text-[13px] font-medium leading-4 text-foreground">
														Search web
													</div>
													<p className="mt-0.5 truncate text-[11px] leading-4 text-muted-foreground">
														{selectedSearchEngineDescription}
													</p>
												</div>
											</CollapsibleTrigger>
											<ToolPermissionControl
												name="Search web"
												value={toolProfile?.tools?.search_web?.permission ?? 'allow'}
												disabled={!toolProfile || fileToolsSaving}
												onChange={(permission) =>
													handleFileToolsPermissionChange('search_web', { permission })
												}
											/>
										</div>
										{profile === 'chat' && (
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
																	<SelectValue
																		placeholder={t('settings.searchEngine.defaultTitle')}
																	>
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
													<SettingsNotice
														variant="destructive"
														icon={AlertTriangle}
														className="mx-3 mt-3"
													>
														{searchEngineError}
													</SettingsNotice>
												)}
											</CollapsibleContent>
										)}
									</Collapsible>
								)}
								{group.tools.map(([name, id, description]) => {
									const settings = toolProfile?.tools?.[id] ?? { permission: 'allow' };
									return (
										<SettingsRow
											key={id}
											title={name}
											media={
												<Icon
													className="size-5 shrink-0 text-muted-foreground"
													aria-hidden="true"
												/>
											}
											description={description}
										actions={
											<ToolPermissionControl
												name={name}
												value={settings.permission}
												disabled={!toolProfile || fileToolsSaving}
												onChange={(permission) =>
													handleFileToolsPermissionChange(id, { permission })
												}
											/>
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
