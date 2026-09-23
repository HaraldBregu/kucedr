import React, { useEffect, useRef, useState } from 'react';
import { CalendarHeatmap } from '@thilakbhat/heatmap-ui';
import '@thilakbhat/heatmap-ui/styles.css';
import { useTranslation } from 'react-i18next';

const ACTIVITY_WEEKS = 53;
const ACTIVITY_GAP = 1;
const ACTIVITY_LABEL_WIDTH = 32;

export function Activity(): React.JSX.Element {
	const { t } = useTranslation();
	const [values, setValues] = useState<readonly { date: string; value: number }[]>([]);
	const [failed, setFailed] = useState(false);
	const [cellSize, setCellSize] = useState(9);
	const containerRef = useRef<HTMLDivElement>(null);
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

	useEffect(() => {
		const container = containerRef.current;
		if (!container || typeof ResizeObserver === 'undefined') return;

		const resize = (width: number): void => {
			if (width <= 0) return;
			const available = width - ACTIVITY_LABEL_WIDTH - (ACTIVITY_WEEKS - 1) * ACTIVITY_GAP;
			const nextSize = Math.max(4, Math.min(12, Math.floor(available / ACTIVITY_WEEKS)));
			setCellSize((current) => (current === nextSize ? current : nextSize));
		};

		resize(container.clientWidth);
		const observer = new ResizeObserver((entries) => resize(entries[0]?.contentRect.width ?? 0));
		observer.observe(container);
		return () => observer.disconnect();
	}, []);

	return (
		<div ref={containerRef} className="w-full py-1">
			<CalendarHeatmap
				values={[...values]}
				weeks={ACTIVITY_WEEKS}
				weekStart={1}
				to={yearEnd}
				cellSize={cellSize}
				gap={ACTIVITY_GAP}
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
