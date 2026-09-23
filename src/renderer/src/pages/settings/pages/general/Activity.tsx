import React from 'react';
import { CalendarHeatmap } from '@thilakbhat/heatmap-ui';
import '@thilakbhat/heatmap-ui/styles.css';
import { useTranslation } from 'react-i18next';
import { SettingsPanel } from '../../components';

export interface ActivityDay {
	readonly date: string;
	readonly value: number;
}

interface ActivityProps {
	readonly values?: readonly ActivityDay[];
}

export function Activity({ values = [] }: ActivityProps): React.JSX.Element {
	const { t } = useTranslation();

	return (
		<SettingsPanel>
			<div className="overflow-x-auto px-4 py-3">
				<CalendarHeatmap
					values={[...values]}
					weeks={20}
					weekStart={1}
					to={new Date().toISOString().slice(0, 10)}
					showLegend
					showMonthLabels
					showWeekdayLabels
					unitLabel={t('settings.activity.events')}
					ariaLabel={t('settings.activity.title')}
					tooltip={(day) => t('settings.activity.day', { date: day.date, count: day.value })}
				/>
				{values.length === 0 && (
					<p className="mt-3 text-[11px] text-muted-foreground">
						{t('settings.activity.empty')}
					</p>
				)}
			</div>
		</SettingsPanel>
	);
}
