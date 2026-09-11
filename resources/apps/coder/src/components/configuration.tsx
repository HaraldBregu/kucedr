import {
	CODING_THINKING_LEVELS,
	app,
	type CodingProviderId,
	type CodingThinkingLevel,
	type CodingToolMode,
} from '@kucedr/sdk';
import { AlertTriangle, Check, Copy, ExternalLink } from 'lucide-react';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Choice } from '@/components/choice';
import { Setting } from '@/components/setting';
import { useConfiguration } from '@/hooks/configuration';

export function Configuration({ onDone }: { onDone: () => void }) {
	const configuration = useConfiguration();
	const settings = configuration.settings;
	const provider = configuration.selectedProvider;
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
				<h1 className="flex-1 text-xs font-medium">Configuration</h1>
				{configuration.saving ? (
					<span className="text-[11px] text-muted-foreground">Saving…</span>
				) : null}
				<Button variant="ghost" size="sm" onClick={onDone}>
					Done
				</Button>
			</header>

			<div className="min-h-0 flex-1 overflow-y-auto px-4 pb-8 pt-4 sm:px-6">
				<div className="mx-auto max-w-2xl space-y-7">
					<div>
						<h2 className="mb-4 text-sm font-medium">Runtime</h2>
						{configuration.loading || !settings ? (
							<div className="space-y-3">
								<Skeleton className="h-9 w-full" />
								<Skeleton className="h-9 w-full" />
								<Skeleton className="h-9 w-full" />
							</div>
						) : (
							<div className="space-y-5">
								<Setting title="Agent" description="Coding-agent runtime">
									<span className="text-xs text-muted-foreground">Pi</span>
								</Setting>
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
										options={CODING_THINKING_LEVELS.map((level) => ({
											value: level,
											label:
												level === 'xhigh' ? 'Extra high' : level[0].toUpperCase() + level.slice(1),
										}))}
										disabled={configuration.saving}
										onChange={(value) => configuration.setThinking(value as CodingThinkingLevel)}
									/>
								</Setting>
								<Setting title="Tools" description="Controls which Pi tools can run">
									<Choice
										value={settings.toolMode}
										options={[
											{ value: 'read-only', label: 'Read only' },
											{ value: 'coding', label: 'Coding' },
										]}
										disabled={configuration.saving}
										onChange={(value) => configuration.setTools(value as CodingToolMode)}
									/>
								</Setting>
							</div>
						)}
					</div>

					{settings && provider ? (
						<div>
							<h2 className="mb-4 text-sm font-medium">Authentication</h2>
							<Setting
								title={provider.name}
								description={
									provider.id === 'openai-codex'
										? 'ChatGPT subscription device login'
										: 'Uses the API key saved in Kucedr Providers'
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

					{deviceCode ? (
						<Alert>
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
											onClick={() => void app.openExternalUrl(authUrl)}
										>
											<ExternalLink /> Open sign-in
										</Button>
									) : null}
								</div>
								<p className="text-muted-foreground">Waiting for authorization…</p>
							</div>
						</Alert>
					) : null}

					{settings?.toolMode === 'coding' ? (
						<Alert className="text-destructive">
							<AlertTriangle /> Coding tools run with your desktop account permissions.
						</Alert>
					) : null}
					{configuration.error ? (
						<Alert className="text-destructive">
							<AlertTriangle /> {configuration.error}
						</Alert>
					) : null}
				</div>
			</div>
		</div>
	);
}
