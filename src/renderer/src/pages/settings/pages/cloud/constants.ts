export const DEFAULT_SYNC_CRON_EXPRESSION = '0 3 * * *';

export const SYNC_INTERVALS: readonly { key: string; cron: string }[] = [
	{ key: 'every15m', cron: '*/15 * * * *' },
	{ key: 'every30m', cron: '*/30 * * * *' },
	{ key: 'every1h', cron: '0 * * * *' },
	{ key: 'every3h', cron: '0 */3 * * *' },
	{ key: 'every6h', cron: '0 */6 * * *' },
	{ key: 'every12h', cron: '0 */12 * * *' },
	{ key: 'every1d', cron: DEFAULT_SYNC_CRON_EXPRESSION },
	{ key: 'every2d', cron: '0 3 */2 * *' },
	{ key: 'every7d', cron: '0 3 * * 1' },
];
