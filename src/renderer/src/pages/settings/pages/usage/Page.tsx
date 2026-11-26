import { useEffect, useState } from 'react';
import { ChartNoAxesColumnIncreasing } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { AgentSpendReport } from '@shared/agent_types';
import {
	SettingsNotice,
	SettingsPageHeader,
	SettingsPageShell,
	SettingsPanel,
	SettingsRow,
	SettingsSection,
} from '../../components';

function formatCost(value: number, locale: string): string {
	return value.toLocaleString(locale, {
		style: 'currency',
		currency: 'USD',
		minimumFractionDigits: 2,
		maximumFractionDigits: 8,
	});
}

function formatMonth(month: string, locale: string): string {
	if (month === 'unknown') return month;
	return new Date(`${month}-01T00:00:00`).toLocaleDateString(locale, { month: 'long', year: 'numeric' });
}

export default function UsagePage(): React.JSX.Element {
	const { t, i18n } = useTranslation();
	const [report, setReport] = useState<AgentSpendReport | null>(null);
	const [failed, setFailed] = useState(false);
	const locale = i18n.language;

	useEffect(() => {
		let mounted = true;
		const load = (): void => {
			void window.agent.getSpendReport().then(
				(value) => {
					if (mounted) {
						setReport(value);
						setFailed(false);
					}
				},
				() => {
					if (mounted) setFailed(true);
				}
			);
		};
		load();
		const unsubscribe = window.agent.onSessionsChanged(load);
		return () => {
			mounted = false;
			unsubscribe();
		};
	}, []);

	return (
		<SettingsPageShell>
			<SettingsPageHeader
				title={t('settings.usage.title')}
				description={t('settings.usage.description')}
				icon={ChartNoAxesColumnIncreasing}
			/>
			{failed ? (
				<SettingsNotice variant="destructive">{t('settings.usage.loadError')}</SettingsNotice>
			) : !report ? (
				<SettingsPanel>
					<SettingsRow title={t('settings.usage.loading')} />
				</SettingsPanel>
			) : (
				<>
					<SettingsPanel>
						<SettingsRow
							title={t('settings.usage.total')}
							description={t('settings.usage.reportedRuns', { count: report.reportedRunCount })}
							actions={<span className="text-sm tabular-nums">{formatCost(report.totalCostUsd, locale)}</span>}
						/>
					</SettingsPanel>
					<p className="text-sm text-muted-foreground">{t('settings.usage.coverage')}</p>
					<SettingsSection title={t('settings.usage.byMonth')}>
						<SettingsPanel>
							{report.byMonth.length ? report.byMonth.map((item) => (
								<SettingsRow
									key={item.month}
									title={formatMonth(item.month, locale)}
									description={t('settings.usage.reportedRuns', { count: item.runCount })}
									actions={<span className="text-sm tabular-nums">{formatCost(item.costUsd, locale)}</span>}
								/>
							)) : <SettingsRow title={t('settings.usage.empty')} />}
						</SettingsPanel>
					</SettingsSection>
					<SettingsSection title={t('settings.usage.byProvider')}>
						<SettingsPanel>
							{report.byProvider.length ? report.byProvider.map((item) => (
								<SettingsRow
									key={item.providerId}
									title={item.providerId}
									description={t('settings.usage.tokens', {
										input: item.inputTokens.toLocaleString(locale),
										output: item.outputTokens.toLocaleString(locale),
									})}
									actions={<span className="text-sm tabular-nums">{formatCost(item.costUsd, locale)}</span>}
								/>
							)) : <SettingsRow title={t('settings.usage.empty')} />}
						</SettingsPanel>
					</SettingsSection>
					<SettingsSection title={t('settings.usage.byChat')}>
						<SettingsPanel>
							{report.bySession.length ? report.bySession.map((item) => (
								<SettingsRow
									key={item.sessionId}
									title={item.title || t('settings.usage.untitled')}
									description={t('settings.usage.tokens', {
										input: item.inputTokens.toLocaleString(locale),
										output: item.outputTokens.toLocaleString(locale),
									})}
									actions={<span className="text-sm tabular-nums">{formatCost(item.costUsd, locale)}</span>}
								/>
							)) : <SettingsRow title={t('settings.usage.empty')} />}
						</SettingsPanel>
					</SettingsSection>
				</>
			)}
		</SettingsPageShell>
	);
}
