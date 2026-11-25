import React, { useState } from 'react';
import { Fingerprint } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function Screen({ touchId }: { readonly touchId: boolean }): React.JSX.Element {
	const { t } = useTranslation();
	const [passphrase, setPassphrase] = useState('');
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState('');

	const run = async (attempt: () => Promise<unknown>): Promise<void> => {
		setBusy(true);
		setError('');
		try {
			await attempt();
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : t('lock.failed'));
		} finally {
			setBusy(false);
		}
	};

	return (
		<main className="flex h-screen items-center justify-center bg-background p-6 text-foreground">
			<Card className="w-full max-w-sm">
				<CardHeader>
					<CardTitle>{t('appTitle')}</CardTitle>
					<CardDescription>{t('lock.description')}</CardDescription>
				</CardHeader>
				<CardContent>
					<form
						className="grid gap-4"
						onSubmit={(event) => {
							event.preventDefault();
							void run(() => window.app.unlock(passphrase));
						}}
					>
						<Field>
							<Label htmlFor="lock-passphrase">{t('lock.passphrase')}</Label>
							<Input
								id="lock-passphrase"
								type="password"
								autoFocus
								autoComplete="current-password"
								value={passphrase}
								onChange={(event) => setPassphrase(event.target.value)}
							/>
						</Field>
						{error && (
							<p role="alert" className="text-sm text-destructive">
								{error}
							</p>
						)}
						<Button type="submit" disabled={busy || !passphrase}>
							{t('lock.unlock')}
						</Button>
						{touchId && (
							<Button
								type="button"
								variant="outline"
								disabled={busy}
								onClick={() => void run(() => window.app.unlockWithTouchId())}
							>
								<Fingerprint />
								{t('lock.touchId')}
							</Button>
						)}
					</form>
				</CardContent>
			</Card>
		</main>
	);
}
