import React, { useState } from 'react';
import { AlertCircle, CheckCircle2, Eye, EyeOff, LoaderCircle, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
	Field,
	FieldDescription,
	FieldGroup,
	FieldLabel,
	FieldSeparator,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import googleIcon from '@resources/providers/google/images/fallback_lobehub/svg/google-color.svg';

type Mode = 'signIn' | 'signUp' | 'forgot';

export function AuthStep(): React.JSX.Element {
	const { state } = useAuth();
	const [mode, setMode] = useState<Mode>('signIn');
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [confirmation, setConfirmation] = useState('');
	const [showPassword, setShowPassword] = useState(false);
	const [busy, setBusy] = useState(false);
	const [googleBusy, setGoogleBusy] = useState(false);
	const [error, setError] = useState('');
	const [forgotSent, setForgotSent] = useState(false);
	const [dismissedConfirmation, setDismissedConfirmation] = useState(false);

	const recovery = state.status === 'recovery';
	const showConfirmation = state.status === 'confirmationRequired' && !dismissedConfirmation;
	const title = recovery
		? 'Choose a new password'
		: mode === 'signUp'
			? 'Create your Kucedr account'
			: mode === 'forgot'
				? 'Reset your password'
				: 'Welcome back';
	const description = recovery
		? 'Your recovery link is valid. Set a new password to continue.'
		: mode === 'signUp'
			? 'Create an account to sync Kucedr securely across your devices.'
			: mode === 'forgot'
				? 'We will email you a secure recovery link.'
				: 'Sign in to open your Kucedr workspace.';

	const switchMode = (next: Mode): void => {
		setMode(next);
		setError('');
		setPassword('');
		setConfirmation('');
		setForgotSent(false);
	};

	const submit = async (event: React.FormEvent): Promise<void> => {
		event.preventDefault();
		setError('');
		if ((mode === 'signUp' || recovery) && password !== confirmation) {
			setError('The passwords do not match.');
			return;
		}
		setBusy(true);
		try {
			if (recovery) await window.auth.updatePassword(password);
			else if (mode === 'signUp') {
				setDismissedConfirmation(false);
				await window.auth.signUp({ email, password });
			} else if (mode === 'forgot') {
				await window.auth.requestPasswordReset(email);
				setForgotSent(true);
			} else await window.auth.signIn({ email, password });
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : 'Authentication failed.');
		} finally {
			setBusy(false);
		}
	};

	const signInWithGoogle = async (): Promise<void> => {
		setError('');
		setGoogleBusy(true);
		try {
			await window.auth.signInWithGoogle();
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : 'Google sign-in failed.');
		} finally {
			setGoogleBusy(false);
		}
	};

	const disabled = busy || googleBusy;

	if (state.status === 'unconfigured') {
		return (
			<div className="flex min-h-full items-center justify-center px-6 py-8">
				<Card className="w-full max-w-sm">
					<CardHeader>
						<h1 className="text-base font-medium leading-snug">
							Kucedr account services are unavailable
						</h1>
						<CardDescription>
							Sign-in and cloud sync are not available right now. You can continue using Kucedr on
							this device.
						</CardDescription>
					</CardHeader>
				</Card>
			</div>
		);
	}

	if (showConfirmation) {
		return (
			<div className="flex min-h-full items-center justify-center px-6 py-8">
				<Card className="w-full max-w-sm">
					<CardHeader className="items-center text-center">
						<div className="mb-2 flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
							<Mail className="size-5" aria-hidden="true" />
						</div>
						<h1 className="text-base font-medium leading-snug">Check your email</h1>
						<CardDescription>
							We sent a confirmation link to {state.email ?? 'your email address'}.
						</CardDescription>
					</CardHeader>
					<CardContent className="flex flex-col gap-2">
						<Button
							type="button"
							variant="outline"
							disabled={busy}
							onClick={() => {
								setBusy(true);
								void window.auth
									.resendConfirmation(state.email ?? email)
									.catch((cause) =>
										setError(cause instanceof Error ? cause.message : 'Could not resend email.')
									)
									.finally(() => setBusy(false));
							}}
						>
							{busy ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : null}
							Resend confirmation
						</Button>
						<Button
							type="button"
							variant="ghost"
							onClick={() => {
								setDismissedConfirmation(true);
								switchMode('signIn');
							}}
						>
							Back to sign in
						</Button>
						{error ? (
							<p className="text-xs text-destructive" role="alert">
								{error}
							</p>
						) : null}
					</CardContent>
				</Card>
			</div>
		);
	}

	return (
		<div className="flex min-h-full items-center justify-center px-4 py-8 sm:px-6">
			<div className="flex w-full max-w-sm flex-col gap-6">
				<Card>
					<CardHeader className="text-center">
						<CardTitle className="text-xl">
							<h1 className="text-xl font-medium leading-snug">{title}</h1>
						</CardTitle>
						<CardDescription>{description}</CardDescription>
					</CardHeader>
					<CardContent>
						{forgotSent ? (
							<div className="flex flex-col gap-4 text-center" role="status" aria-live="polite">
								<CheckCircle2 className="mx-auto size-8 text-primary" aria-hidden="true" />
								<p className="text-sm">Check your email for a recovery link.</p>
								<Button
									type="button"
									variant="outline"
									className="w-full"
									onClick={() => switchMode('signIn')}
								>
									Back to sign in
								</Button>
							</div>
						) : (
							<form onSubmit={submit}>
								<FieldGroup>
									{!recovery && mode !== 'forgot' ? (
										<>
											<Button
												type="button"
												variant="outline"
												size="lg"
												className="w-full"
												disabled={disabled}
												onClick={() => void signInWithGoogle()}
											>
												{googleBusy ? (
													<LoaderCircle className="animate-spin" aria-hidden="true" />
												) : (
													<img src={googleIcon} alt="" className="size-4" aria-hidden="true" />
												)}
												{mode === 'signUp' ? 'Sign up with Google' : 'Sign in with Google'}
											</Button>
											<FieldSeparator>Or continue with</FieldSeparator>
										</>
									) : null}
									{!recovery ? (
										<Field>
											<FieldLabel htmlFor="auth-email">Email</FieldLabel>
											<Input
												id="auth-email"
												type="email"
												autoComplete="email"
												placeholder="you@example.com"
												autoFocus
												required
												value={email}
												disabled={disabled}
												onChange={(event) => setEmail(event.target.value)}
											/>
										</Field>
									) : null}
									{mode !== 'forgot' || recovery ? (
										<Field>
											<div className="flex items-center justify-between">
												<FieldLabel htmlFor="auth-password">
													{recovery ? 'New password' : 'Password'}
												</FieldLabel>
												{mode === 'signIn' && !recovery ? (
													<Button
														type="button"
														variant="link"
														size="xs"
														className="h-auto px-0"
														onClick={() => switchMode('forgot')}
													>
														Forgot password?
													</Button>
												) : null}
											</div>
											<div className="relative">
												<Input
													id="auth-password"
													type={showPassword ? 'text' : 'password'}
													autoComplete={
														mode === 'signIn' && !recovery ? 'current-password' : 'new-password'
													}
													minLength={mode === 'signIn' && !recovery ? undefined : 8}
													required
													value={password}
													disabled={disabled}
													onChange={(event) => setPassword(event.target.value)}
												/>
												<Button
													type="button"
													variant="ghost"
													size="icon"
													className="absolute right-1 top-1 size-8"
													aria-label={showPassword ? 'Hide password' : 'Show password'}
													onClick={() => setShowPassword((visible) => !visible)}
												>
													{showPassword ? <EyeOff /> : <Eye />}
												</Button>
											</div>
										</Field>
									) : null}
									{mode === 'signUp' || recovery ? (
										<Field>
											<FieldLabel htmlFor="auth-confirmation">Confirm password</FieldLabel>
											<Input
												id="auth-confirmation"
												type={showPassword ? 'text' : 'password'}
												autoComplete="new-password"
												minLength={8}
												required
												value={confirmation}
												disabled={disabled}
												onChange={(event) => setConfirmation(event.target.value)}
											/>
										</Field>
									) : null}
									{error ? (
										<div
											className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-2.5 text-xs text-destructive"
											role="alert"
										>
											<AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
											<span>{error}</span>
										</div>
									) : null}
									<Button type="submit" size="lg" className="w-full" disabled={disabled}>
										{busy ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : null}
										{recovery
											? 'Update password'
											: mode === 'signUp'
												? 'Create account'
												: mode === 'forgot'
													? 'Send recovery link'
													: 'Sign in'}
									</Button>
									{!recovery ? (
										<FieldDescription className="text-center">
											{mode === 'signUp'
												? 'Already have an account? '
												: mode === 'forgot'
													? ''
													: "Don't have an account? "}
											<Button
												type="button"
												variant="link"
												size="xs"
												className="h-auto px-0 font-medium"
												onClick={() =>
													switchMode(
														mode === 'signUp' ? 'signIn' : mode === 'forgot' ? 'signIn' : 'signUp'
													)
												}
											>
												{mode === 'signUp'
													? 'Sign in'
													: mode === 'forgot'
														? 'Back to sign in'
														: 'Create an account'}
											</Button>
										</FieldDescription>
									) : null}
								</FieldGroup>
							</form>
						)}
						{state.persistence === 'memory' ? (
							<p className="mt-3 text-center text-[10px] leading-4 text-muted-foreground">
								Secure system storage is unavailable, so this session will not persist after
								restart.
							</p>
						) : null}
					</CardContent>
				</Card>
				{!recovery && mode !== 'forgot' ? (
					<FieldDescription className="px-6 text-center">
						By continuing, you agree to our <a href="#">Terms of Service</a> and{' '}
						<a href="#">Privacy Policy</a>.
					</FieldDescription>
				) : null}
			</div>
		</div>
	);
}
