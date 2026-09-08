import React, { useCallback, useEffect, useState } from 'react';
import { Bot, Pencil, Plus, Trash2 } from 'lucide-react';
import type { A2aAgentInput, A2aAgentSummary } from '@shared/a2a_types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import {
	SettingsEmptyState,
	SettingsNotice,
	SettingsPageHeader,
	SettingsPageShell,
	SettingsPanel,
	SettingsSection,
} from '../../components';

const empty: A2aAgentInput = {
	name: '',
	url: '',
	authType: 'none',
	credential: '',
	apiKeyHeader: 'X-API-Key',
	enabled: true,
};

export default function A2aPage(): React.JSX.Element {
	const [agents, setAgents] = useState<A2aAgentSummary[]>([]);
	const [form, setForm] = useState<A2aAgentInput>(empty);
	const [adding, setAdding] = useState(false);
	const [busy, setBusy] = useState(false);
	const [notice, setNotice] = useState<{ error?: boolean; text: string }>();
	const load = useCallback(async () => setAgents(await window.a2a.list()), []);
	useEffect(() => {
		void Promise.resolve().then(load);
	}, [load]);
	const submit = async (): Promise<void> => {
		setBusy(true);
		setNotice(undefined);
		try {
			const result = await window.a2a.save(form);
			setNotice({ text: `Connected to ${result.cardName || result.name}.` });
			setForm(empty);
			setAdding(false);
			await load();
		} catch (error) {
			setNotice({ error: true, text: error instanceof Error ? error.message : String(error) });
		} finally {
			setBusy(false);
		}
	};
	return (
		<SettingsPageShell>
			<SettingsPageHeader
				title="A2A"
				description="Connect remote Agent2Agent-compatible agents and delegate work to them."
				action={
					<Button
						size="xs"
						onClick={() => {
							setForm(empty);
							setAdding(true);
						}}
					>
						<Plus className="size-3" />
						Add agent
					</Button>
				}
			/>
			{notice && (
				<SettingsNotice variant={notice.error ? 'destructive' : undefined}>
					{notice.text}
				</SettingsNotice>
			)}
			{adding && (
				<SettingsSection title="Remote agent">
					<SettingsPanel>
						<div className="grid gap-3 p-3">
							<div className="grid gap-1">
								<Label htmlFor="a2a-name">Name</Label>
								<Input
									id="a2a-name"
									value={form.name}
									onChange={(event) => setForm({ ...form, name: event.target.value })}
									placeholder="Research agent"
								/>
							</div>
							<div className="grid gap-1">
								<Label htmlFor="a2a-url">Base URL</Label>
								<Input
									id="a2a-url"
									value={form.url}
									onChange={(event) => setForm({ ...form, url: event.target.value })}
									placeholder="https://agent.example.com"
								/>
							</div>
							<div className="grid gap-1">
								<Label htmlFor="a2a-auth">Authentication</Label>
								<Select
									value={form.authType ?? 'none'}
									onValueChange={(value) =>
										setForm({ ...form, authType: value as A2aAgentInput['authType'] })
									}
								>
									<SelectTrigger id="a2a-auth" className="w-full">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="none">No authentication</SelectItem>
										<SelectItem value="bearer">Bearer token</SelectItem>
										<SelectItem value="api-key">API key header</SelectItem>
										<SelectItem value="private-key-jwt">OAuth private_key_jwt</SelectItem>
									</SelectContent>
								</Select>
							</div>
							{form.authType === 'api-key' && (
								<div className="grid gap-1">
									<Label htmlFor="a2a-api-key-header">API key header</Label>
									<Input
										id="a2a-api-key-header"
										value={form.apiKeyHeader ?? ''}
										onChange={(event) => setForm({ ...form, apiKeyHeader: event.target.value })}
										placeholder="X-API-Key"
									/>
								</div>
							)}
							{form.authType === 'private-key-jwt' && (
								<div className="grid gap-1">
									<Label htmlFor="a2a-client-id">Client ID</Label>
									<Input
										id="a2a-client-id"
										value={form.clientId ?? ''}
										onChange={(event) => setForm({ ...form, clientId: event.target.value })}
									/>
								</div>
							)}
							{form.authType !== 'none' && (
								<div className="grid gap-1">
									<Label htmlFor="a2a-credential">
										{form.authType === 'private-key-jwt' ? 'Private JWK' : 'Secret'}
									</Label>
									<Input
										id="a2a-credential"
										type="password"
										value={form.credential ?? ''}
										onChange={(event) => setForm({ ...form, credential: event.target.value })}
										placeholder={
											form.id
												? 'Leave blank to keep the current secret'
												: form.authType === 'private-key-jwt'
													? '{"kty":"OKP",…}'
													: ''
										}
									/>
								</div>
							)}
							<label className="flex items-center gap-2 text-xs">
								<input
									type="checkbox"
									checked={form.enabled ?? true}
									onChange={(event) => setForm({ ...form, enabled: event.target.checked })}
								/>
								Enabled
							</label>
							<div className="flex justify-end gap-2">
								<Button
									variant="outline"
									size="xs"
									onClick={() => {
										setForm(empty);
										setAdding(false);
									}}
								>
									Cancel
								</Button>
								<Button size="xs" disabled={busy || !form.url.trim()} onClick={() => void submit()}>
									{busy ? 'Validating…' : 'Validate and save'}
								</Button>
							</div>
						</div>
					</SettingsPanel>
				</SettingsSection>
			)}
			<SettingsPanel>
				{agents.length === 0 ? (
					<SettingsEmptyState
						icon={Bot}
						title="No A2A agents"
						description="Add a remote agent to make delegation available to Kucedr."
					/>
				) : (
					<div className="divide-y divide-border">
						{agents.map((agent) => (
							<div key={agent.id} className="flex items-center justify-between gap-3 p-3">
								<div>
									<div className="text-sm font-medium">{agent.name}</div>
									<div className="text-xs text-muted-foreground">{agent.url}</div>
									<div className="mt-1 text-[10px] text-muted-foreground">
										{agent.skills.join(', ') || 'No advertised skills'}
									</div>
									<div className="mt-1 text-[10px] text-muted-foreground">
										{agent.enabled ? 'Enabled' : 'Disabled'} ·{' '}
										{agent.authType === 'none'
											? 'No authentication'
											: agent.hasCredential
												? `${agent.authType === 'api-key' ? 'API key' : agent.authType === 'private-key-jwt' ? 'OAuth private key' : 'Bearer'} configured`
												: 'Credential unavailable'}
									</div>
								</div>
								<div className="flex gap-1">
									<Button
										variant="ghost"
										size="icon-xs"
										aria-label={`Edit ${agent.name}`}
										onClick={() => {
											setForm({
												id: agent.id,
												name: agent.name,
												url: agent.url,
												authType: agent.authType,
												apiKeyHeader: agent.apiKeyHeader,
												clientId: agent.clientId,
												credential: '',
												enabled: agent.enabled,
											});
											setAdding(true);
										}}
									>
										<Pencil className="size-3" />
									</Button>
									<Button
										variant="ghost"
										size="icon-xs"
										aria-label={`Delete ${agent.name}`}
										onClick={() => void window.a2a.delete(agent.id).then(load)}
									>
										<Trash2 className="size-3" />
									</Button>
								</div>
							</div>
						))}
					</div>
				)}
			</SettingsPanel>
		</SettingsPageShell>
	);
}
