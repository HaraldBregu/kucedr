import React, { useEffect, useState } from 'react';
import { CalendarHeatmap } from '@thilakbhat/heatmap-ui';
import '@thilakbhat/heatmap-ui/styles.css';
import './Activity.css';
import { useTranslation } from 'react-i18next';

export function Activity(): React.JSX.Element {
	const { t } = useTranslation();
	const [values, setValues] = useState<readonly { date: string; value: number }[]>([]);
	const [failed, setFailed] = useState(false);
	const [tooltip, setTooltip] = useState<{
		readonly label: string;
		readonly x: number;
		readonly y: number;
	} | null>(null);
	const today = new Date().toISOString().slice(0, 10);

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
				data-testid="activity-scroll"
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
					values={[...values]}
					weeks={30}
					weekStart={1}
					to={today}
					shape="rounded"
					scale="log"
					colors={['#0e4429', '#006d32', '#26a641', '#39d353']}
					emptyColor="#161b22"
					showMonthLabels
					unitLabel={t('settings.activity.events')}
					ariaLabel={t('settings.activity.title')}
					cellLabel={(day) =>
						t('settings.activity.day', { date: day.date, count: day.value })
					}
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
