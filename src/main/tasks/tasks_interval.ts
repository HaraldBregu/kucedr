import cron from 'node-cron';

export function cronInterval(expression: string): number {
	const { second, minute, hour } = cron.parse(expression);
	if (second.length > 1) return 0;
	const times = hour.flatMap((h) => minute.map((m) => h * 60 + m)).sort((a, b) => a - b);
	return Math.min(...times.map((time, index) => (times[index + 1] ?? times[0]! + 1440) - time));
}
