import cron from 'node-cron';

const MINUTE = 60_000;
const LOOKBACK = 31 * 24 * 60 * MINUTE;

// Whether the schedule had a run time after `since` and before the current minute, in local time.
// ponytail: walks minute by minute over at most 31 days; day names like `5#2` never match.
export function missed(expression: string, since: Date, now = new Date()): boolean {
	const { minute, hour, dayOfMonth, month, dayOfWeek } = cron.parse(expression);
	const day = (time: Date): boolean => {
		const last = new Date(time.getFullYear(), time.getMonth() + 1, 0).getDate();
		return dayOfMonth.some((value) => value === time.getDate() || (value === 'L' && time.getDate() === last));
	};
	const end = Math.floor(now.getTime() / MINUTE) * MINUTE - MINUTE;
	const start = Math.max(since.getTime(), now.getTime() - LOOKBACK);
	for (let at = end; at > start; at -= MINUTE) {
		const time = new Date(at);
		if (
			minute.includes(time.getMinutes()) &&
			hour.includes(time.getHours()) &&
			month.includes(time.getMonth() + 1) &&
			dayOfWeek.includes(time.getDay()) &&
			day(time)
		)
			return true;
	}
	return false;
}
