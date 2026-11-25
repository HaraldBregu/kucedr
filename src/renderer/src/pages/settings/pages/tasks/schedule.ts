type Translate = (key: string, options?: Record<string, unknown>) => string;

export function describeSchedule(expression: string | undefined, t: Translate): string {
	if (!expression) return t('settings.cron.schedule.notScheduled');
	const fields = expression.trim().split(/\s+/);
	if (fields.length === 6 && fields[0] === '0') fields.shift();
	if (fields.length !== 5) return expression;

	const [minute, hour, dayOfMonth, month, dayOfWeek] = fields;
	const time =
		hour !== '*' && minute !== '*' ? `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}` : '';
	if (minute === '*' && hour === '*' && dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
		return t('settings.cron.schedule.everyMinute');
	}
	if (
		/^\*\/\d+$/.test(minute) &&
		hour === '*' &&
		dayOfMonth === '*' &&
		month === '*' &&
		dayOfWeek === '*'
	) {
		return t('settings.cron.schedule.everyMinutes', { count: minute.slice(2) });
	}
	if (minute === '0' && hour === '*' && dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
		return t('settings.cron.schedule.everyHour');
	}
	if (
		/^\*\/\d+$/.test(hour) &&
		minute === '0' &&
		dayOfMonth === '*' &&
		month === '*' &&
		dayOfWeek === '*'
	) {
		return t('settings.cron.schedule.everyHours', { count: hour.slice(2) });
	}
	if (dayOfMonth === '1' && month === '*' && dayOfWeek === '*') {
		return time
			? t('settings.cron.schedule.monthlyAt', { time })
			: t('settings.cron.schedule.monthly');
	}
	if (dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
		return time ? t('settings.cron.schedule.dailyAt', { time }) : t('settings.cron.schedule.daily');
	}
	return expression;
}
