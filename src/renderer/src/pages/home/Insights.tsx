import { useEffect, useState, type ReactElement } from 'react';
import { ChartNoAxesColumn, Cpu, Wrench } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { AgentRunInsights } from '@shared/agent_types';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { formatDuration } from '@/components/prompt-kit/duration';

export function Insights({ sessionId, reply }: {
	readonly sessionId: string;
	readonly reply: string | number;
}): ReactElement {
	const { t, i18n } = useTranslation();
	const [open, setOpen] = useState(false);
	const [data, setData] = useState<AgentRunInsights | null>();
	const [failed, setFailed] = useState(false);

	useEffect(() => {
		if (!open) return;
		let current = true;
		setData(undefined);
		setFailed(false);
		window.agent.getRunInsights(sessionId, reply).then(
			(result) => { if (current) setData(result); },
			() => { if (current) setFailed(true); }
		);
		return () => { current = false; };
	}, [open, sessionId, reply]);

	const title = t('chat.insights.title');
	const locale = i18n?.language;
	const metrics: [string, string | undefined][] = data ? [
		['firstToken', data.firstTokenMs === undefined ? undefined : formatDuration(data.firstTokenMs)],
		['turns', data.turns?.toLocaleString(locale)],
		['input', data.inputTokens?.toLocaleString(locale)],
		['output', data.outputTokens?.toLocaleString(locale)],
		['cached', data.cachedTokens?.toLocaleString(locale)],
		['cost', data.costUsd?.toLocaleString(locale, {
			style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 8,
		})],
	] : [];
	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger render={<Button type="button" variant="ghost" size="icon-xs"
				className="text-muted-foreground hover:text-foreground" aria-label={title} title={title} />}>
				<ChartNoAxesColumn className="size-3.5" />
			</DialogTrigger>
			{open && <DialogContent className="sm:max-w-md">
				<DialogTitle>{title}</DialogTitle>
				{data && !failed ? <>
					<dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 text-sm">
						{metrics.map(([key, value]) => (
							<div className="contents" key={key}>
								<dt className="text-muted-foreground">{t(`chat.insights.${key}`)}</dt>
								<dd className="text-right tabular-nums">{value ?? t('chat.insights.unavailable')}</dd>
							</div>
						))}
					</dl>
					{data.steps.length > 0 && <section className="border-t pt-3">
						<h3 className="mb-2 text-sm font-medium">{t('chat.insights.timeline')}</h3>
						<ol className="grid gap-2">
							{data.steps.map((step, index) => (
								<li key={index} className="flex items-baseline gap-2 text-sm">
									{step.kind === 'model' ? <Cpu aria-hidden className="size-3.5 shrink-0 self-center" />
										: <Wrench aria-hidden className="size-3.5 shrink-0 self-center" />}
									<span className="min-w-0 flex-1 break-words">
										<span className="text-muted-foreground">{t(`chat.insights.${step.kind}`)} </span>{step.name}
									</span>
									<span className="text-right text-xs text-muted-foreground tabular-nums">
										{step.offsetMs !== undefined && <span className="block">+{formatDuration(step.offsetMs)}</span>}
										{step.durationMs !== undefined && t('chat.insights.duration', { time: formatDuration(step.durationMs) })}
									</span>
								</li>
							))}
						</ol>
					</section>}
				</> : <p role="status" className="text-sm text-muted-foreground">
					{t(failed ? 'chat.insights.error' : data === null ? 'chat.insights.empty' : 'chat.insights.loading')}
				</p>}
			</DialogContent>}
		</Dialog>
	);
}
