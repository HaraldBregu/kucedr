import { SettingsItemMedia } from '../../../components/item-media';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
	AlertTriangle,
	Image as ImageIcon,
	Music2,
	Search as SearchIcon,
	Sparkles,
	Video,
} from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
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
import type { CatalogWebSearch } from '../../../../../../../shared/provider_types';
import type { SearchEngineId, SearchSettings } from '../../../../../../../shared/search_types';
import type {
	AgentToolConfiguration,
	AgentToolProfile,
	AgentToolProfileId,
	AgentToolReference,
} from '../../../../../../../shared/agent_tools';
import { isAgentToolAllowedForProfile } from '../../../../../../../shared/agent_tools';
import { isAgentToolConfigurable } from '../../../../../../../shared/agent_tools';
import { ToolPermissionControl } from './Permission';
import { ORDERED_AGENT_TOOL_GROUPS } from './groups';

const ToolsPage: React.FC<{ profile?: AgentToolProfileId }> = ({ profile = 'chat' }) => {
	const { t } = useTranslation();
	const [searchSettings, setSearchSettings] = useState<SearchSettings | null>(null);
	const [searchServices, setSearchServices] = useState<CatalogWebSearch[]>([]);
	const [searchEngineError, setSearchEngineError] = useState<string | null>(null);
	const [searchSavingEngineId, setSearchSavingEngineId] = useState<SearchEngineId | null>(null);
	const [toolProfile, setToolProfile] = useState<AgentToolProfile | null>(null);
	const [fileToolsSaving, setFileToolsSaving] = useState(false);
	const [fileToolsError, setFileToolsError] = useState<string | null>(null);
	const selectedSearchEngine = searchServices.find(
		(service) => `${service.provider.id}/${service.id}` === searchSettings?.engineId
	);
	const selectedSearchEngineDescription = selectedSearchEngine
		? selectedSearchEngine.description ?? selectedSearchEngine.provider.name
		: t('settings.searchEngine.defaultDescription');
	const filteredToolGroups = ORDERED_AGENT_TOOL_GROUPS.map((group) => ({
		...group,
		tools: group.tools.filter(([, id]) =>
			isAgentToolAllowedForProfile(profile, { kind: 'builtin', id })
		),
	}));

	useEffect(() => {
		if (profile !== 'chat') return;
		let mounted = true;
		void Promise.all([window.search.getSettings(), window.services.list()]).then(
			([next, services]) => {
				if (!mounted) return;
				setSearchSettings(next);
				setSearchServices(services.filter((service) => service.type === 'SEARCH_ENGINE'));
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
			.then(
				(next) =>
					setToolProfile((current) => ({ ...next, tools: { ...current?.tools, ...next.tools } })),
				(error) => {
					setFileToolsError(firstErrorMessage(error, t('settings.modelServices.saveError')));
				}
			)
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
			{profile !== 'health' && profile !== 'tasks' && (
				<SettingsSection
					title={t('settings.modelServices.agentTools.groups.media')}
					className="order-2"
				>
					<SettingsPanel>
						<SettingsRow
							title={t('settings.modelServices.imageAssistantName')}
							description={t('settings.modelServices.imageModelDescription')}
							media={<ImageIcon className="size-5 shrink-0 text-muted-foreground" />}
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
							media={<Music2 className="size-5 shrink-0 text-muted-foreground" />}
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
							media={<Video className="size-5 shrink-0 text-muted-foreground" />}
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
						{Object.entries(toolProfile?.tools ?? {})
							.filter(
								([id]) =>
									id.startsWith('mdl__') &&
									isAgentToolAllowedForProfile(profile, { kind: 'builtin', id })
							)
							.map(([id, settings]) => (
								<SettingsRow
									key={id}
									title={id}
									media={<Sparkles className="size-5 shrink-0 text-muted-foreground" />}
									actions={
										<ToolPermissionControl
											name={id}
											value={settings.permission}
											disabled={fileToolsSaving}
											onChange={(permission) =>
												handleFileToolsPermissionChange(id, { permission })
											}
										/>
									}
								/>
							))}
					</SettingsPanel>
				</SettingsSection>
			)}

			{filteredToolGroups
				.filter(
					(group) =>
						group.titleKey !== 'media' &&
						(group.tools.length > 0 || (profile !== 'health' && group.titleKey === 'web'))
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
												<SettingsItemMedia>
													<SearchIcon className="size-5" aria-hidden="true" />
												</SettingsItemMedia>
												<div className="min-w-0 flex-1">
													<div className="truncate text-[13px] font-medium leading-4 text-foreground">
														Search web
													</div>
													<p className="mt-0.5 truncate text-xs leading-4 text-muted-foreground">
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
																				{selectedSearchEngine ? `${selectedSearchEngine.provider.name} - ${selectedSearchEngine.name}` : undefined}
																	</SelectValue>
																</SelectTrigger>
																<SelectContent>
																			{searchServices.map((service) => (
																		<SelectItem
																					key={`${service.provider.id}/${service.id}`}
																					value={`${service.provider.id}/${service.id}`}
																					disabled={!searchSettings?.configured[`${service.provider.id}/${service.id}`]}
																		>
																					{service.provider.name} - {service.name}
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
												isAgentToolConfigurable({ kind: 'builtin', id }) ? (
													<ToolPermissionControl
														name={name}
														value={settings.permission}
														disabled={!toolProfile || fileToolsSaving}
														onChange={(permission) =>
															handleFileToolsPermissionChange(id, { permission })
														}
													/>
												) : undefined
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
