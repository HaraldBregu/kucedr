import { useState, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { ShieldAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
	Card,
	CardAction,
	CardContent,
	CardFooter,
	CardHeader,
	CardTitle,
} from '@/components/ui/card';
import type { AgentToolPermissionDecision } from '@/lib/compat';
import type { PendingToolPermission } from '../context';

const TOOL_ACTIONS: Record<string, string> = {
	read: 'read files',
	write: 'write files',
	edit: 'edit files',
	patch: 'apply this patch',
	bash: 'run this command',
};

export function ToolPermissionCard({
	permission,
}: {
	readonly permission: PendingToolPermission;
}): ReactElement {
	const { t } = useTranslation();
	const [responding, setResponding] = useState(false);
	const [error, setError] = useState<string>();
	const input = permission.input && typeof permission.input === 'object'
		? permission.input as Record<string, unknown>
		: {};
	const processPayload = [input.action, input.text ?? input.literal ?? input.bytes]
		.filter((value): value is string => typeof value === 'string' && value.length > 0)
		.join(': ');
	const detail = typeof input.command === 'string'
		? input.command
		: typeof input.path === 'string'
			? input.path
			: typeof input.directory === 'string'
				? input.directory
				: processPayload || JSON.stringify(input, null, 2);
	const action = t(`toolPermission.actions.${permission.toolName}`, {
		defaultValue: TOOL_ACTIONS[permission.toolName] ?? `use ${permission.toolName}`,
	});
	const sensitiveOperation = permission.reason === 'sensitive_operation';
	const hostExecution = permission.reason === 'host_execution';
	const destructiveOperation = permission.reason === 'destructive_operation';
	const reasonKey = hostExecution
		? 'toolPermission.hostReason'
		: destructiveOperation
			? 'toolPermission.destructiveReason'
			: 'toolPermission.outsideReason';
	const badgeKey = hostExecution
		? 'toolPermission.hostAccess'
		: destructiveOperation
			? 'toolPermission.destructiveOperation'
			: 'toolPermission.outsideLocations';

	const respond = (decision: AgentToolPermissionDecision): void => {
		if (responding) return;
		setResponding(true);
		setError(undefined);
		void window.agent
			.respondToolPermission(
				{
					approvalId: permission.approvalId,
					runId: permission.runId,
					toolName: permission.toolName,
					inputFingerprint: permission.inputFingerprint,
				},
				decision
			)
			.then((accepted) => {
				if (!accepted) throw new Error(t('toolPermission.expired'));
			})
			.catch((cause: unknown) => {
				setResponding(false);
				setError(cause instanceof Error ? cause.message : t('toolPermission.responseFailed'));
			});
	};

	return (
		<Card size="sm" className="mb-2 w-full max-w-2xl" role="alert" aria-live="assertive">
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					<ShieldAlert className="size-4 shrink-0 text-muted-foreground" />
					{t('toolPermission.title', { action })}
				</CardTitle>
				<CardAction>
					<Badge variant={hostExecution || destructiveOperation ? 'destructive' : 'secondary'}>
						{sensitiveOperation ? t('toolPermission.sensitiveAccess', { defaultValue: 'Sensitive action' }) : t(badgeKey)}
					</Badge>
				</CardAction>
			</CardHeader>
			<CardContent className="space-y-2">
				{permission.targets.length > 0 && (
					<div>
						<p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{t('toolPermission.location')}</p>
						<div className="space-y-1">
							{permission.targets.map((target) => (
								<p key={target} className="break-all rounded-md bg-muted px-2 py-1.5 font-mono text-xs">{target}</p>
							))}
						</div>
					</div>
				)}
				<p className="text-xs text-muted-foreground">
					{sensitiveOperation ? t('toolPermission.sensitiveReason', { defaultValue: 'Approve this specific action before the assistant accesses a service, records media, spends money, or saves lasting changes.' }) : t(reasonKey)}
				</p>
				{detail && <pre className="max-h-24 overflow-auto whitespace-pre-wrap break-all rounded-md bg-muted px-2 py-1.5 font-mono text-xs text-muted-foreground"><code>{detail}</code></pre>}
				{error && <p className="text-xs text-destructive" aria-live="polite">{error}</p>}
			</CardContent>
			<CardFooter className="flex flex-wrap justify-end gap-2">
				<Button type="button" variant="ghost" size="sm" disabled={responding} onClick={() => respond('reject')}>{t('toolPermission.deny')}</Button>
				{permission.persistable && (
					<Button type="button" variant="outline" size="sm" disabled={responding} onClick={() => respond('approve_always')}>{t('toolPermission.trustLocation')}</Button>
				)}
				{permission.allowOnce && (
					<Button type="button" size="sm" disabled={responding} onClick={() => respond('approve')}>{t('toolPermission.allowOnce')}</Button>
				)}
			</CardFooter>
		</Card>
	);
}
