import { useEffect, useState } from 'react';
import { Check, Copy, ExternalLink } from 'lucide-react';
import type { CoderHarness, CodingAuthEvent, CodingCatalog } from '@shared/coding_types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type Entry = {
	runtime: CoderHarness;
	provider: 'openai-codex' | 'openai' | 'anthropic' | 'cline';
	key?: 'openai' | 'anthropic' | 'cline';
	label: string;
	account?: boolean;
};

const entries: readonly Entry[] = [
	{ runtime: 'pi', provider: 'openai-codex', label: 'Pi · ChatGPT', account: true },
	{ runtime: 'pi', provider: 'openai', key: 'openai', label: 'Pi · OpenAI API' },
	{ runtime: 'pi', provider: 'anthropic', key: 'anthropic', label: 'Pi · Anthropic API' },
	{ runtime: 'codex', provider: 'openai-codex', key: 'openai', label: 'Codex', account: true },
	{ runtime: 'cline', provider: 'cline', key: 'cline', label: 'Cline', account: true },
];

export function Authentication({ onChanged }: { onChanged: (runtime: CoderHarness) => void }) {
	const [catalogs, setCatalogs] = useState<Partial<Record<CoderHarness, CodingCatalog>>>({});
	const [catalogErrors, setCatalogErrors] = useState<Partial<Record<CoderHarness, string>>>({});
	const [keys, setKeys] = useState<Record<string, string>>({});
	const [busy, setBusy] = useState('');
	const [event, setEvent] = useState<CodingAuthEvent | null>(null);
	const [error, setError] = useState('');
	const refresh = async (runtime: CoderHarness) => {
		const catalog = await window.coder.listModels(runtime);
		setCatalogs((current) => ({ ...current, [runtime]: catalog }));
		setCatalogErrors((current) => ({ ...current, [runtime]: undefined }));
		onChanged(runtime);
	};
	useEffect(() => {
		let active = true;
		void Promise.allSettled(
			(['pi', 'codex', 'cline'] as const).map(async (runtime) => {
				try {
					const catalog = await window.coder.listModels(runtime);
					if (active) setCatalogs((current) => ({ ...current, [runtime]: catalog }));
				} catch (cause) {
					if (active)
						setCatalogErrors((current) => ({
							...current,
							[runtime]: cause instanceof Error ? cause.message : String(cause),
						}));
				}
			})
		);
		return () => {
			active = false;
		};
	}, []);
	const changeKey = async (entry: Entry, value: string) => {
		if (!entry.key) return;
		const id = `${entry.runtime}:${entry.provider}`;
		setBusy(id);
		setError('');
		try {
			await window.coder.setApiKey(entry.key, value, entry.runtime);
			setKeys((current) => ({ ...current, [id]: '' }));
			await refresh(entry.runtime);
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : String(cause));
		} finally {
			setBusy('');
		}
	};
	const connect = async (entry: Entry) => {
		const id = `${entry.runtime}:${entry.provider}`;
		setBusy(id);
		setEvent(null);
		setError('');
		try {
			await window.coder.connectCodex((next) => {
				setEvent(next);
				const url =
					next.type === 'device-code'
						? next.verificationUri
						: next.type === 'auth-url'
							? next.url
							: null;
				if (url) void window.app.openExternalUrl(url);
			}, entry.runtime);
			await refresh(entry.runtime);
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : String(cause));
		} finally {
			setBusy('');
			setEvent(null);
		}
	};
	const disconnect = async (entry: Entry) => {
		const id = `${entry.runtime}:${entry.provider}`;
		setBusy(id);
		setError('');
		try {
			await window.coder.disconnectCodex(entry.runtime);
			await refresh(entry.runtime);
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : String(cause));
		} finally {
			setBusy('');
		}
	};
	return (
		<div className="space-y-2">
			<h2 className="text-sm font-medium">Harness authentication</h2>
			{entries.map((entry) => {
				const id = `${entry.runtime}:${entry.provider}`;
				const provider = catalogs[entry.runtime]?.providers.find(
					(item) => item.id === entry.provider
				);
				const connected = Boolean(provider?.configured);
				const accountConnected = connected && provider?.authType === 'oauth';
				const keyConnected = connected && !accountConnected && Boolean(entry.key);
				return (
					<div key={id} className="rounded-md border px-3 py-2">
						<div className="flex items-center justify-between gap-2">
							<p className="text-xs font-medium">{entry.label}</p>
							<span className="flex items-center gap-1 text-[11px] text-muted-foreground">
								{connected ? <Check className="size-3" /> : null}
								{connected ? 'Connected' : 'Not connected'}
							</span>
						</div>
						<p className="text-[11px] text-muted-foreground">
							{catalogErrors[entry.runtime] ??
								(provider
									? accountConnected
										? 'Account'
										: keyConnected
											? 'API key'
											: 'Ready to connect'
									: 'Checking connection…')}
						</p>
						<div className="mt-2 flex flex-wrap items-center gap-2">
						{entry.account &&
							(busy === id ? (
								<Button
									size="sm"
									variant="outline"
									onClick={() => void window.coder.cancelCodexLogin()}
								>
									Cancel
								</Button>
							) : accountConnected ? (
								<Button
									size="sm"
									variant="outline"
									disabled={Boolean(busy)}
									onClick={() => void disconnect(entry)}
								>
									Disconnect
								</Button>
							) : (
								<Button
									size="sm"
									variant="outline"
									disabled={Boolean(busy)}
									onClick={() => void connect(entry)}
								>
									Connect account
								</Button>
							))}
						{entry.key && (
							<>
								{keyConnected && (
									<Button
										size="sm"
										variant="ghost"
										disabled={Boolean(busy)}
										onClick={() => void changeKey(entry, '')}
									>
										Remove key
									</Button>
								)}
								<Input
									type="password"
									aria-label={`${entry.label} API key`}
									autoComplete="off"
									placeholder="API key"
									className="h-8 min-w-32 max-w-48 flex-1"
									value={keys[id] ?? ''}
									disabled={Boolean(busy)}
									onChange={(change) =>
										setKeys((current) => ({ ...current, [id]: change.target.value }))
									}
								/>
								<Button
									size="sm"
									disabled={Boolean(busy) || !keys[id]?.trim()}
									onClick={() => void changeKey(entry, keys[id].trim())}
								>
									Save key
								</Button>
						</>
						)}
						</div>
					</div>
				);
			})}
			{event?.type === 'device-code' && (
				<div role="status" className="rounded-lg border bg-card px-3 py-2 text-xs">
					<p>Enter this code on the sign-in page:</p>
					<code className="block select-all py-2 font-mono text-lg font-semibold tracking-widest">
						{event.userCode}
					</code>
					<div className="flex gap-2">
						<Button
							size="sm"
							variant="outline"
							onClick={() => void navigator.clipboard.writeText(event.userCode)}
						>
							<Copy /> Copy code
						</Button>
						<Button
							size="sm"
							variant="outline"
							onClick={() => void window.app.openExternalUrl(event.verificationUri)}
						>
							<ExternalLink /> Open sign-in
						</Button>
					</div>
				</div>
			)}
			{error && (
				<p role="alert" className="text-xs text-destructive">
					{error}
				</p>
			)}
		</div>
	);
}
