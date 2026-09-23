import React, { useEffect, useState } from 'react';
import { CalendarHeatmap } from '@thilakbhat/heatmap-ui';
import '@thilakbhat/heatmap-ui/styles.css';
import { useTranslation } from 'react-i18next';

export function Activity(): React.JSX.Element {
	const { t } = useTranslation();
	const [values, setValues] = useState<readonly { date: string; value: number }[]>([]);
	const [failed, setFailed] = useState(false);
	const yearEnd = `${new Date().getUTCFullYear()}-12-31`;

	useEffect(() => {
		let active = true;
		void window.app
			.getActivity()
			.then((activity) => {
				if (active) setValues(activity);
			})
			.catch(() => {
				if (active) setFailed(true);
			});
		return () => {
			active = false;
		};
	}, []);

	return (
		<div className="overflow-x-auto py-1">
				<CalendarHeatmap
					values={[...values]}
					weeks={53}
					weekStart={1}
					to={yearEnd}
					showLegend
					showMonthLabels
					showWeekdayLabels
					unitLabel={t('settings.activity.events')}
					ariaLabel={t('settings.activity.title')}
					tooltip={(day) => t('settings.activity.day', { date: day.date, count: day.value })}
				/>
				{failed ? (
					<p className="mt-3 text-[11px] text-muted-foreground">
						{t('settings.activity.error')}
					</p>
				) : values.length === 0 ? (
					<p className="mt-3 text-[11px] text-muted-foreground">
						{t('settings.activity.empty')}
					</p>
				) : null}
		</div>
	);
}
