import { CHANNEL_PROVIDER_IDS, type ChannelCatalogEntry, type ChannelType } from './channels_types';

export const CHANNEL_CATALOG: readonly ChannelCatalogEntry[] = [
	{
		id: 'telegram',
		label: 'Telegram',
		blurb: 'Receive Telegram bot messages and send agent replies.',
		brandIconId: 'telegram',
	},
];

const CHANNEL_CATALOG_BY_ID = new Map<string, ChannelCatalogEntry>(
	CHANNEL_CATALOG.map((entry) => [entry.id, entry])
);

export function getChannelCatalogEntry(idOrAlias: string): ChannelCatalogEntry | undefined {
	const id = normalizeChannelId(idOrAlias);
	return id ? CHANNEL_CATALOG_BY_ID.get(id) : undefined;
}

export function getChannelBrandIconId(idOrAlias: string): string | undefined {
	return getChannelCatalogEntry(idOrAlias)?.brandIconId;
}

export function normalizeChannelId(idOrAlias: string): ChannelType | null {
	const normalized = idOrAlias.trim().toLowerCase();
	return isChannelId(normalized) ? normalized : null;
}

export function isChannelId(value: string): value is ChannelType {
	return (CHANNEL_PROVIDER_IDS as readonly string[]).includes(value);
}
