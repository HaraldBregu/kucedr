import React, { useEffect, useState } from 'react';
import { CalendarHeatmap } from '@thilakbhat/heatmap-ui';
import '@thilakbhat/heatmap-ui/styles.css';
import './Activity.css';
import { useTranslation } from 'react-i18next';
import { useApp } from '@/contexts';

export type ActivityRange = 'untilToday' | 'currentYear' | 'lastYear';

export function Activity({ range }: { readonly range: ActivityRange }): React.JSX.Element {
	const { t } = useTranslation();
	const { theme } = useApp();
	const [systemDark, setSystemDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches);
	const [values, setValues] = useState<readonly { date: string; value: number }[]>([]);
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
	const endDate = range === 'lastYear' ? Date.UTC(year - 1, 11, 31) : Date.UTC(year, now.getMonth(), now.getDate());
	const startOffset = (new Date(Date.UTC(selectedYear, 0, 1)).getUTCDay() + 6) % 7;
	const weeks = range === 'untilToday'
		? 39
		: Math.ceil(((endDate - Date.UTC(selectedYear, 0, 1)) / 86400000 + 1 + startOffset) / 7);
	const visibleValues = range === 'untilToday'
		? values
		: values.filter((day) => day.date.startsWith(`${selectedYear}-`) && day.date <= end);

	useEffect(() => {
		const media = window.matchMedia('(prefers-color-scheme: dark)');
		const onChange = (event: MediaQueryListEvent): void => setSystemDark(event.matches);
		media.addEventListener('change', onChange);
		return () => media.removeEventListener('change', onChange);
	}, []);

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
				<CalendarHeatmap
					values={[...visibleValues]}
					weeks={weeks}
					gap={2}
					cellSize={13}
					weekStart={1}
					to={end}
					shape="rounded"
					scale="linear"
					levels={8}
					colors={[
						'#0e4429',
						'#08562d',
						'#026731',
						'#0b7d36',
						'#1b963d',
						'#29ac44',
						'#31c04b',
						'#39d353',
					]}
					emptyColor="var(--activity-empty-color)"
					data-heatmap-theme={theme === 'system' ? (systemDark ? 'dark' : 'light') : theme}
					showMonthLabels
					unitLabel={t('settings.activity.events')}
					ariaLabel={t('settings.activity.title')}
					cellLabel={(day) =>
						t('settings.activity.day', { date: day.date, count: day.value })
					}
					showLegend
				/>
				{failed ? (
					<p className="mt-3 text-[11px] text-muted-foreground">
						{t('settings.activity.error')}
					</p>
				) : visibleValues.length === 0 ? (
					<p className="mt-3 text-[11px] text-muted-foreground">
						{t('settings.activity.empty')}
					</p>
				) : null}
			</div>
			{tooltip && (
				<div
					role="tooltip"
					className="pointer-events-none fixed z-50 max-w-55 -translate-x-1/2 -translate-y-full rounded-md border border-border bg-popover px-2 py-1 text-[11px] text-popover-foreground shadow-md"
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
