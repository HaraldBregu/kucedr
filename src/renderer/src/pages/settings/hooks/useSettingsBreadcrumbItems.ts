import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useMatch } from 'react-router-dom';
import { getChannelCatalogEntry } from '../../../../../shared';
import { SETTINGS_MODEL_SERVICE_ITEMS, SETTINGS_NAVIGATION } from '../navigation';
import { getSystemMedia } from '../pages/general/media/media';

interface SettingsBreadcrumbItem {
	readonly label: string;
	readonly path?: string;
}

const ASSISTANT_SUBPAGE_LABEL_KEYS: Record<string, string> = {
	'/settings/agent/chathistory': 'settings.chatHistory.title',
	'/settings/agent/permissions': 'settings.tabs.permissions',
	'/settings/agent/tools': 'settings.modelServices.tools',
	'/settings/agent/mcp-tools': 'settings.modelServices.agentTools.mcp.title',
};

const PROVIDER_SUBPAGE_LABEL_KEYS: Record<string, string> = {
	'/settings/providers/models': 'settings.overview.groups.mlModels',
	'/settings/providers/search': 'settings.tabs.searchEngines',
	'/settings/providers/database': 'settings.tabs.databases',
	'/settings/providers/storage': 'settings.tabs.storage',
};

function formatAppLabel(appId: string): string {
	return appId
		.split(/[-_\s]+/)
		.filter(Boolean)
		.map((part) => `${part.charAt(0).toLocaleUpperCase()}${part.slice(1)}`)
		.join(' ');
}

export function useSettingsBreadcrumbItems(): readonly SettingsBreadcrumbItem[] {
	const { t } = useTranslation();
	const location = useLocation();
	const mcpDetailMatch = useMatch('/settings/mcp/:mcpServerId');
	const appDetailMatch = useMatch('/settings/apps/:appId');
	const appId = decodeURIComponent(appDetailMatch?.params.appId ?? '');
	const [appLabel, setAppLabel] = useState<{ id: string; label: string } | null>(null);

	useEffect(() => {
		if (!appId) return;

		let active = true;
		void window.apps
			.list()
			.then((apps) => {
				const app = apps.find((item) => item.id === appId);
				if (active && app) setAppLabel({ id: appId, label: app.title });
			})
			.catch(() => undefined);

		return () => {
			active = false;
		};
	}, [appId]);

	if (location.pathname === '/settings') return [];
	if (location.pathname === '/settings/general/persona') {
		return [
			{ label: t('settings.tabs.general'), path: '/settings/general' },
			{ label: t('settings.voiceAgent.title') },
		];
	}
	if (location.pathname === '/settings/voice/history') {
		return [
			{ label: t('settings.tabs.voice'), path: '/settings/voice' },
			{ label: t('settings.modelServices.voiceHistoryTitle') },
		];
	}
	if (location.pathname === '/settings/voice/tools') {
		return [
			{ label: t('settings.tabs.voice'), path: '/settings/voice' },
			{ label: t('settings.modelServices.tools') },
		];
	}
	if (location.pathname === '/settings/tasks/history') {
		return [
			{ label: t('settings.tabs.taskScheduler'), path: '/settings/tasks' },
			{ label: t('settings.cron.history.pageTitle') },
		];
	}
	if (location.pathname === '/settings/tasks/tools') {
		return [
			{ label: t('settings.tabs.taskScheduler'), path: '/settings/tasks' },
			{ label: t('settings.modelServices.tools') },
		];
	}
	if (location.pathname === '/settings/health/tools') {
		return [
			{ label: t('settings.tabs.health'), path: '/settings/health' },
			{ label: t('settings.modelServices.tools') },
		];
	}
	if (location.pathname === '/settings/channels/tools') {
		return [
			{ label: t('settings.tabs.channels'), path: '/settings/channels' },
			{ label: t('settings.modelServices.tools') },
		];
	}
	const assistantSubpageLabelKey = ASSISTANT_SUBPAGE_LABEL_KEYS[location.pathname];
	if (assistantSubpageLabelKey) {
		const assistantItem = SETTINGS_MODEL_SERVICE_ITEMS.find((item) => item.id === 'assistant');
		return [
			{
				label: assistantItem ? t(assistantItem.labelKey) : t('settings.modelServices.chatName'),
				path: '/settings/agent',
			},
			{ label: t(assistantSubpageLabelKey) },
		];
	}
	const providerSubpageLabelKey = PROVIDER_SUBPAGE_LABEL_KEYS[location.pathname];
	if (providerSubpageLabelKey) {
		return [
			{ label: t('settings.tabs.providers'), path: '/settings/providers' },
			{ label: t(providerSubpageLabelKey) },
		];
	}

	const serviceItem = SETTINGS_MODEL_SERVICE_ITEMS.find((item) => item.path === location.pathname);
	if (serviceItem) {
		if (serviceItem.path.startsWith('/settings/providers/')) {
			return [
				{ label: t('settings.tabs.providers'), path: '/settings/providers' },
				{ label: t(serviceItem.labelKey) },
			];
		}
		return [{ label: t(serviceItem.labelKey) }];
	}

	if (mcpDetailMatch) {
		return [
			{ label: t('settings.tabs.mcp'), path: '/settings/mcp' },
			{ label: mcpDetailMatch.params.mcpServerId ?? '' },
		];
	}

	if (appDetailMatch) {
		return [
			{ label: t('settings.tabs.apps'), path: '/settings/apps' },
			{ label: appLabel?.id === appId ? appLabel.label : formatAppLabel(appId) },
		];
	}

	const current = SETTINGS_NAVIGATION.filter(
		(item) => location.pathname === item.path || location.pathname.startsWith(`${item.path}/`)
	).sort((a, b) => b.path.length - a.path.length)[0];
	if (!current) return [];

	const items: SettingsBreadcrumbItem[] = [{ label: t(current.labelKey) }];

	if (location.pathname.startsWith('/settings/tasks/') && location.pathname.endsWith('/detail')) {
		items[0] = { ...items[0], path: current.path };
		items.push({ label: t('settings.cron.detail.title') });
	}

	if (location.pathname.startsWith('/settings/channels/channelDetail/')) {
		const channelId = decodeURIComponent(location.pathname.split('/').at(-1) ?? '');
		const channelLabel = getChannelCatalogEntry(channelId)?.label ?? channelId;
		items[0] = { ...items[0], path: current.path };
		items.push({ label: channelLabel });
	}

	if (location.pathname.startsWith('/settings/skills/skilldetails/')) {
		const skillId = decodeURIComponent(location.pathname.split('/').at(-1) ?? '');
		items[0] = { ...items[0], path: current.path };
		items.push({ label: skillId });
	}

	if (location.pathname.startsWith('/settings/general/media/')) {
		const media = getSystemMedia(decodeURIComponent(location.pathname.split('/').at(-1) ?? ''));
		items[0] = { ...items[0], path: current.path };
		items.push({ label: media ? t(media.titleKey) : t('settings.tabs.general') });
	}

	if (location.pathname.startsWith('/settings/agent/')) {
		items.unshift({ label: t('settings.modelServices.chatName'), path: '/settings/agent' });
	}

	return items;
}
