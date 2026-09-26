import {
	CODING_THINKING_LEVELS,
	type CodingProviderId,
	type CodingSettings,
	type CodingThinkingLevel,
	type CodingToolMode,
} from '@shared/coding_types';
import { useState } from 'react';
import { AlertTriangle, Check, Copy, ExternalLink } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Choice } from './Choice';
import { Setting } from './Setting';
import { useConfiguration } from './hooks/configuration';

export function Configuration({
	onDone,
	initial,
	session,
}: {
	onDone: (settings?: CodingSettings) => void;
	initial?: CodingSettings | null;
	session?: { projectId: string; id: string };
}) {
	const [defaults, setDefaults] = useState(!session);
	const configuration = useConfiguration(initial, session, defaults);
	const settings = configuration.settings;
	const provider = configuration.selectedProvider;
	const supportedThinking = provider?.models.find(
		(model) => model.id === settings?.modelId
	)?.thinkingLevels;
	const deviceCode =
		configuration.authEvent?.type === 'device-code' ? configuration.authEvent : null;
	const authUrl =
		configuration.authEvent?.type === 'device-code'
			? configuration.authEvent.verificationUri
			: configuration.authEvent?.type === 'auth-url'
				? configuration.authEvent.url
				: null;

	return (
		<div className="flex min-h-0 flex-1 flex-col bg-background">
			<header className="flex h-11 shrink-0 items-center gap-2 px-3">
				<h1 className="flex-1 text-xs font-medium">
					{defaults ? 'Harness defaults' : 'Session configuration'}
				</h1>
				{session && (
					<Button
						variant="ghost"
						size="sm"
						disabled={configuration.saving || configuration.connecting}
						onClick={() => setDefaults(!defaults)}
					>
						{defaults ? 'Session settings' : 'Harness defaults'}
					</Button>
				)}
				{configuration.saving ? (
					<span className="text-[11px] text-muted-foreground">Saving…</span>
				) : null}
				<Button
					variant="ghost"
					size="sm"
					disabled={configuration.saving || configuration.connecting}
					onClick={() => onDone(settings ?? undefined)}
				>
					Done
				</Button>
			</header>

			<div className="min-h-0 flex-1 overflow-y-auto px-4 pb-8 pt-4 sm:px-6">
				<div className="mx-auto max-w-2xl space-y-7">
					<div>
						<h2 className="mb-4 text-sm font-medium">Runtime</h2>
						{configuration.loading ? (
							<div className="space-y-3">
								<Skeleton className="h-9 w-full" />
								<Skeleton className="h-9 w-full" />
								<Skeleton className="h-9 w-full" />
							</div>
						) : settings ? (
							<div className="space-y-5">
								<Setting title="Harness">
									<Choice
										value={settings.runtime}
										options={[
											{ value: 'pi', label: 'Pi' },
											{ value: 'codex', label: 'Codex' },
											{ value: 'cline', label: 'Cline' },
										]}
										disabled={!defaults || configuration.saving || configuration.connecting}
										onChange={(value) =>
											void configuration.setHarness(value as CodingSettings['runtime'])
										}
									/>
								</Setting>
								{defaults && (
									<Setting title="Default folder">
										<Button
											variant="outline"
											size="sm"
											className="max-w-64 truncate"
											disabled={configuration.saving}
											onClick={() => void configuration.chooseDirectory()}
										>
											{settings.workingDirectory || 'Choose folder'}
										</Button>
									</Setting>
								)}
								<Setting title="Provider">
									<Choice
										value={settings.providerId}
										options={configuration.catalog.providers.map((item) => ({
											value: item.id,
											label: item.name,
										}))}
										disabled={configuration.saving}
										onChange={(value) => configuration.setProvider(value as CodingProviderId)}
									/>
								</Setting>
								<Setting title="Model">
									<Choice
										value={settings.modelId}
										options={(provider?.models ?? []).map((model) => ({
											value: model.id,
											label: model.name,
										}))}
										disabled={configuration.saving || !provider?.models.length}
										onChange={configuration.setModel}
									/>
								</Setting>
								<Setting title="Thinking">
									<Choice
										value={settings.thinkingLevel}
										options={CODING_THINKING_LEVELS.filter((level) =>
											supportedThinking
												? supportedThinking.includes(level)
											: settings.runtime === 'pi' ||
												['low', 'medium', 'high', 'xhigh'].includes(level)
										).map((level) => ({
											value: level,
											label:
												level === 'xhigh' ? 'Extra high' : level[0].toUpperCase() + level.slice(1),
										}))}
										disabled={configuration.saving}
										onChange={(value) => configuration.setThinking(value as CodingThinkingLevel)}
									/>
								</Setting>
								<Setting title="Tools" description="Controls which tools can run">
									<Choice
										value={settings.toolMode}
										options={[
											{ value: 'read-only', label: 'Read only' },
											{ value: 'coding', label: 'Coder' },
										]}
										disabled={configuration.saving}
										onChange={(value) => configuration.setTools(value as CodingToolMode)}
									/>
								</Setting>
							</div>
						) : null}
					</div>

					{settings && provider ? (
						<div>
							<h2 className="mb-4 text-sm font-medium">Authentication</h2>
							<Setting
								title={provider.name}
								description={
									provider.id === 'openai-codex' && provider.authType !== 'api_key'
										? settings.runtime === 'codex'
											? 'ChatGPT sign-in'
											: 'ChatGPT device sign-in'
										: 'API key saved securely in Coder'
								}
							>
								<span className="flex items-center gap-1 text-[11px] text-muted-foreground">
									{provider.configured ? <Check className="size-3" /> : null}
									{provider.configured ? 'Connected' : 'Not connected'}
								</span>
								{provider.id === 'openai-codex' ? (
									provider.configured ? (
										<Button
											variant="outline"
											size="sm"
											disabled={configuration.connecting}
											onClick={() => void configuration.disconnect()}
										>
											Disconnect
										</Button>
									) : configuration.connecting ? (
										<Button
											variant="outline"
											size="sm"
											onClick={() => void configuration.cancelConnect()}
										>
											Cancel
										</Button>
									) : (
										<Button size="sm" onClick={() => void configuration.connect()}>
											Connect
										</Button>
									)
								) : null}
							</Setting>
						</div>
					) : null}

					{settings && (settings.runtime !== 'pi' || settings.providerId !== 'openai-codex') && (
						<Setting title="API key">
							{provider?.configured &&
								(provider.authType === 'api_key' || provider.authentication === 'api-key') && (
									<Button
										variant="ghost"
										size="sm"
										disabled={configuration.saving}
										onClick={() => void configuration.removeKey()}
									>
										Remove key
									</Button>
								)}
							<Input
								type="password"
								aria-label="API key"
								autoComplete="off"
								placeholder="Enter API key"
								value={configuration.apiKey}
								disabled={configuration.saving}
								onChange={(event) => configuration.setApiKey(event.target.value)}
								className="max-w-64"
							/>
							<Button
								size="sm"
								disabled={configuration.saving || !configuration.apiKey.trim()}
								onClick={() => void configuration.saveKey()}
							>
								Save key
							</Button>
						</Setting>
					)}
					{deviceCode ? (
						<div
							role="status"
							className="rounded-lg border bg-card px-3 py-2 text-sm text-card-foreground"
						>
							<div className="space-y-2 text-xs">
								<p>Enter this device code on the OpenAI sign-in page:</p>
								<code className="block select-all font-mono text-lg font-semibold tracking-widest">
									{deviceCode.userCode}
								</code>
								<div className="flex flex-wrap gap-2">
									<Button
										variant="outline"
										size="sm"
										onClick={() => void navigator.clipboard.writeText(deviceCode.userCode)}
									>
										<Copy /> Copy code
									</Button>
									{authUrl ? (
										<Button
											variant="outline"
											size="sm"
											onClick={() => void window.app.openExternalUrl(authUrl)}
										>
											<ExternalLink /> Open sign-in
										</Button>
									) : null}
								</div>
								<p className="text-muted-foreground">Waiting for authorization…</p>
							</div>
						</div>
					) : null}

					{settings?.toolMode === 'coding' ? (
						<div
							role="alert"
							className="flex items-center gap-2 rounded-lg border px-3 py-2 text-xs text-destructive [&>svg]:size-4"
						>
							<AlertTriangle /> Coder tools run with your desktop account permissions.
						</div>
					) : null}
					{configuration.error ? (
						<div
							role="alert"
							className="flex items-center gap-2 rounded-lg border px-3 py-2 text-xs text-destructive [&>svg]:size-4"
						>
							<AlertTriangle /> {configuration.error}
						</div>
					) : null}
				</div>
			</div>
		</div>
	);
}
