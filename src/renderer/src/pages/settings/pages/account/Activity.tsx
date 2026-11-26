import React, { useEffect, useState } from 'react';
import { CalendarHeatmap, calendarPeriods } from '@thilakbhat/heatmap-ui';
import '@thilakbhat/heatmap-ui/styles.css';
import './Activity.css';
import { useTranslation } from 'react-i18next';
import { ChartNoAxesColumnIncreasing } from 'lucide-react';
import { SettingsEmptyState, SettingsLoadingRows } from '../../components';

export type ActivityRange = 'untilToday' | 'currentYear' | 'lastYear';

export function Activity({ range }: { readonly range: ActivityRange }): React.JSX.Element {
	const { t } = useTranslation();
	const [values, setValues] = useState<readonly { date: string; value: number }[]>([]);
	const [loading, setLoading] = useState(true);
	const [failed, setFailed] = useState(false);
	const [tooltip, setTooltip] = useState<{
		readonly label: string;
		readonly x: number;
		readonly y: number;
	} | null>(null);
	const now = new Date();
	const year = now.getFullYear();
	const today = `${year}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
	const end = range === 'lastYear' ? `${year - 1}-12-31` : today;
	const selectedYear = range === 'lastYear' ? year - 1 : year;
	const periods = calendarPeriods(values, { today: now });
	const period = periods[0];
	const visibleValues = range === 'untilToday'
		? values
		: values.filter((day) => day.date.startsWith(`${selectedYear}-`) && day.date <= end);
	useEffect(() => {
		let active = true;
		void window.app
			.getActivity()
			.then((activity) => {
				if (active) setValues(activity);
			})
			.catch(() => {
				if (active) setFailed(true);
			})
			.finally(() => {
				if (active) setLoading(false);
			});
		return () => {
			active = false;
		};
	}, []);

	return (
		<>
			<div
 				className="card-body"
				onPointerMove={(event) => {
					const cell = (event.target as HTMLElement).closest('.heatmap__cell-slot');
					const label = cell?.getAttribute('aria-label');
					if (!label) return setTooltip(null);
					setTooltip({ label, x: event.clientX, y: event.clientY });
				}}
				onPointerLeave={() => setTooltip(null)}
			>
				{loading ? <SettingsLoadingRows rows={3} /> : failed ? (
					<SettingsEmptyState icon={ChartNoAxesColumnIncreasing} title={t('settings.activity.error')} />
				) : visibleValues.length === 0 ? (
					<SettingsEmptyState icon={ChartNoAxesColumnIncreasing} title={t('settings.activity.empty')} />
				) : <CalendarHeatmap
					values={[...visibleValues]}
					weeks={{ max: 90 }}
					gap={2}
					cellSize={15}
					weekStart={1}
					{...(range === 'untilToday' ? period.range : { to: end })}
					shape="rounded"
					scale="linear"
					colors={['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)']}
					emptyColor="var(--muted)"
					showMonthLabels
					unitLabel={t('settings.activity.events')}
					ariaLabel={t('settings.activity.title')}
					cellLabel={(day) =>
						t('settings.activity.day', { date: day.date, count: day.value })
					}
					showLegend
				/>}
			</div>
			{tooltip && (
				<div
					role="tooltip"
					className="pointer-events-none fixed z-50 max-w-55 -translate-x-1/2 -translate-y-full rounded-md border border-border bg-popover px-2 py-1 text-xs text-popover-foreground shadow-md"
					style={{
						left: Math.max(112, Math.min(tooltip.x, window.innerWidth - 112)),
						top: Math.max(48, tooltip.y - 10),
					}}
				>
					{tooltip.label}
				</div>
			)}
		</>
	);
}
