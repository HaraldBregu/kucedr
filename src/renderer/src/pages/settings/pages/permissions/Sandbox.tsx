import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshCw, ShieldAlert, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { SandboxStatus } from '@shared/sandbox';

const Sandbox: React.FC = () => {
	const { t } = useTranslation();
	const [status, setStatus] = useState<SandboxStatus | null>(null);
	const [busy, setBusy] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const check = useCallback(async (): Promise<void> => {
		setBusy(true);
		setError(null);
		try {
			setStatus(await window.app.getSandboxStatus());
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : String(cause));
		} finally {
			setBusy(false);
		}
	}, []);

	useEffect(() => {
		let active = true;
		window.app
			.getSandboxStatus()
			.then((nextStatus) => {
				if (active) setStatus(nextStatus);
			})
			.catch((cause: unknown) => {
				if (active) setError(cause instanceof Error ? cause.message : String(cause));
			})
			.finally(() => {
				if (active) setBusy(false);
			});
		return () => {
			active = false;
		};
	}, []);

	const setup = async (): Promise<void> => {
		setBusy(true);
		setError(null);
		try {
			setStatus(await window.app.setupSandbox());
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : t('settings.permissions.sandboxSetupFailed'));
		} finally {
			setBusy(false);
		}
	};

	const ready = status?.state === 'ready';
	const canSetup = status?.platform === 'win32' && status.state === 'setup_required';
	const label = busy
		? t('settings.permissions.sandboxChecking')
		: status
			? t(`settings.permissions.sandboxStates.${status.state}`)
			: t('settings.permissions.sandboxUnavailable');
	const Icon = ready ? ShieldCheck : ShieldAlert;

	return (
		<Card size="sm" className="py-4!" aria-live="polite">
			<CardHeader className="flex-row items-start justify-between gap-3 px-4!">
				<div className="space-y-1">
					<CardTitle className="flex items-center gap-2">
						<Icon className="size-4" />
						{t('settings.permissions.sandboxTitle')}
					</CardTitle>
					<CardDescription>{t('settings.permissions.sandboxDescription')}</CardDescription>
				</div>
				<Badge variant={ready ? 'secondary' : 'outline'}>{label}</Badge>
			</CardHeader>
			<CardContent className="space-y-3 px-4!">
				{status?.message && (
					<p className="whitespace-pre-line text-xs text-muted-foreground">{status.message}</p>
				)}
				{error && <p className="text-xs text-destructive">{error}</p>}
				{canSetup && (
					<p className="text-xs text-muted-foreground">
						{t('settings.permissions.sandboxSetupHint')}
					</p>
				)}
				<div className="flex justify-end gap-2">
					<Button type="button" variant="outline" size="sm" onClick={() => void check()} disabled={busy}>
						<RefreshCw className="size-3" />
						{t('settings.permissions.sandboxRecheck')}
					</Button>
					{canSetup && (
						<Button type="button" size="sm" onClick={() => void setup()} disabled={busy}>
							{busy
								? t('settings.permissions.sandboxSettingUp')
								: t('settings.permissions.sandboxSetup')}
						</Button>
					)}
				</div>
			</CardContent>
		</Card>
	);
};

export default Sandbox;
