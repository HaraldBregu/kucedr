import { useTranslation } from 'react-i18next';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { ActivityRange } from './Activity';

interface ActivityHeaderProps {
	readonly range: ActivityRange;
	readonly onRangeChange: (range: ActivityRange) => void;
}

export function ActivityHeader({ range, onRangeChange }: ActivityHeaderProps): React.JSX.Element {
	const { t } = useTranslation();
	const year = new Date().getFullYear();

	return (
		<div className="flex flex-col items-start gap-2">
			<div className="min-w-0">
				<h2 className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
					{t('settings.activity.title')}
				</h2>
				<p className="mt-0.5 max-w-2xl text-[10px] leading-4 text-muted-foreground">
					{t('settings.activity.description')}
				</p>
			</div>
			<div className="flex flex-wrap items-center gap-1.5">
				<Select
					value={range}
					onValueChange={(value) => {
						if (value === 'untilToday' || value === 'currentYear' || value === 'lastYear') {
							onRangeChange(value);
						}
					}}
				>
					<SelectTrigger size="sm" className="text-xs" aria-label={t('settings.activity.range')}>
						<SelectValue>
							{range === 'untilToday'
								? t('settings.activity.untilToday')
								: range === 'currentYear'
									? t('settings.activity.currentYear', { year })
									: t('settings.activity.lastYear', { year: year - 1 })}
						</SelectValue>
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="untilToday">{t('settings.activity.untilToday')}</SelectItem>
						<SelectItem value="currentYear">{t('settings.activity.currentYear', { year })}</SelectItem>
						<SelectItem value="lastYear">{t('settings.activity.lastYear', { year: year - 1 })}</SelectItem>
					</SelectContent>
				</Select>
			</div>
		</div>
	);
}
