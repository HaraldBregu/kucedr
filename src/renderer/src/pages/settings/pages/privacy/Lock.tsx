import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LOCK_IDLE_MINUTES, type LockState } from '@shared/lock';
import { Button } from '@/components/ui/button';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useLock } from '@/hooks/lock';
import {
	SettingsField,
	SettingsLoadingRows,
	SettingsNotice,
	SettingsPanel,
	SettingsRow,
} from '../../components';

export function Lock(): React.JSX.Element {
	const { t } = useTranslation();
	const { state, failed, setState } = useLock();
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [dialog, setDialog] = useState(false);
	const [passphrase, setPassphrase] = useState('');
	const [confirm, setConfirm] = useState('');

	const run = async (action: () => Promise<LockState>): Promise<boolean> => {
		setBusy(true);
		setError(null);
		try {
			setState(await action());
			return true;
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : t('settings.privacy.lock.saveFailed'));
			return false;
		} finally {
			setBusy(false);
		}
	};

	const open = (): void => {
		setPassphrase('');
		setConfirm('');
		setError(null);
		setDialog(true);
	};

	const close = (): void => {
		setDialog(false);
		setError(null);
	};

	const submit = async (event: React.FormEvent): Promise<void> => {
		event.preventDefault();
		if (passphrase.length < 4) setError(t('settings.privacy.lock.tooShort'));
		else if (passphrase !== confirm) setError(t('settings.privacy.lock.mismatch'));
		else if (await run(() => window.app.setLock({ enabled: true, passphrase }))) setDialog(false);
	};

	const minutes = (value: number): string =>
		value === 0
			? t('settings.privacy.lock.never')
			: t('settings.privacy.lock.minutes', { count: value });

	if (!state) {
		return failed ? (
			<SettingsNotice variant="destructive">{t('settings.privacy.lock.loadFailed')}</SettingsNotice>
		) : (
			<SettingsPanel>
				<SettingsLoadingRows />
			</SettingsPanel>
		);
	}

	return (
		<>
			<SettingsPanel>
				<SettingsRow
					title={t('settings.privacy.lock.title')}
					description={t('settings.privacy.lock.description')}
					actions={
						<Switch
							aria-label={t('settings.privacy.lock.title')}
							checked={state.enabled}
							disabled={busy}
							onCheckedChange={(enabled) => {
								if (enabled) open();
								else void run(() => window.app.setLock({ enabled: false }));
							}}
						/>
					}
				/>
				{state.enabled && (
					<>
						{state.touchIdAvailable && (
							<SettingsRow
								title={t('settings.privacy.lock.touchId')}
								description={t('settings.privacy.lock.touchIdDescription')}
								actions={
									<Switch
										aria-label={t('settings.privacy.lock.touchId')}
										checked={state.touchId}
										disabled={busy}
										onCheckedChange={(touchId) =>
											void run(() => window.app.setLock({ enabled: true, touchId }))
										}
									/>
								}
							/>
						)}
						<SettingsRow
							title={t('settings.privacy.lock.idle')}
							description={t('settings.privacy.lock.idleDescription')}
							actionClassName="w-auto justify-end"
							actions={
								<Select
									value={String(state.idleMinutes)}
									disabled={busy}
									onValueChange={(value) => {
										if (value !== null) {
											void run(() =>
												window.app.setLock({ enabled: true, idleMinutes: Number(value) })
											);
										}
									}}
								>
									<SelectTrigger
										size="sm"
										className="w-28 text-xs [&_svg]:size-3"
										aria-label={t('settings.privacy.lock.idle')}
									>
										<SelectValue>{minutes(state.idleMinutes)}</SelectValue>
									</SelectTrigger>
									<SelectContent>
										{LOCK_IDLE_MINUTES.map((value) => (
											<SelectItem key={value} value={String(value)}>
												{minutes(value)}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							}
						/>
						<SettingsRow
							title={t('settings.privacy.lock.change')}
							description={t('settings.privacy.lock.changeDescription')}
							actions={
								<Button type="button" variant="outline" disabled={busy} onClick={open}>
									{t('settings.privacy.lock.changeAction')}
								</Button>
							}
						/>
						<SettingsRow
							title={t('settings.privacy.lock.lockNow')}
							description={t('settings.privacy.lock.lockNowDescription')}
							actions={
								<Button
									type="button"
									variant="outline"
									disabled={busy}
									onClick={() => void run(() => window.app.lockNow())}
								>
									{t('settings.privacy.lock.lockNowAction')}
								</Button>
							}
						/>
					</>
				)}
			</SettingsPanel>
			{error && !dialog && <SettingsNotice variant="destructive">{error}</SettingsNotice>}
			<Dialog
				open={dialog}
				onOpenChange={(next) => {
					if (!next) close();
				}}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>{t('settings.privacy.lock.dialogTitle')}</DialogTitle>
						<DialogDescription>{t('settings.privacy.lock.dialogDescription')}</DialogDescription>
					</DialogHeader>
					<form className="space-y-4" onSubmit={(event) => void submit(event)}>
						<SettingsField id="lock-passphrase" label={t('settings.privacy.lock.passphrase')}>
							<Input
								id="lock-passphrase"
								type="password"
								autoFocus
								autoComplete="new-password"
								value={passphrase}
								onChange={(event) => setPassphrase(event.target.value)}
							/>
						</SettingsField>
						<SettingsField id="lock-confirm" label={t('settings.privacy.lock.confirm')}>
							<Input
								id="lock-confirm"
								type="password"
								autoComplete="new-password"
								value={confirm}
								onChange={(event) => setConfirm(event.target.value)}
							/>
						</SettingsField>
						{error && <SettingsNotice variant="destructive">{error}</SettingsNotice>}
						<DialogFooter>
							<Button type="button" variant="outline" onClick={close}>
								{t('common.cancel')}
							</Button>
							<Button type="submit" disabled={busy}>
								{t('common.save')}
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>
		</>
	);
}
