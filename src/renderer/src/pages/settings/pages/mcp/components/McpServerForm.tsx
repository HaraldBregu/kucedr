import React, { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { McpData } from '@shared/mcp_types';
import { googleMcpScopes } from '@shared/google_mcp';
import { isGitHubRemoteMcpUrl } from '@shared/github_mcp';
import { Button } from '@/components/ui/button';
import {
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Item, ItemActions, ItemContent, ItemTitle } from '@/components/ui/item';
import { Label } from '@/components/ui/label';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { SettingsRow } from '../../../components';
import { McpOAuthButton } from './McpOAuthButton';

type EnvVariable = {
	readonly key: string;
	readonly value: string;
};

function parseEnvEntries(env?: Readonly<Record<string, string>>): EnvVariable[] {
	return Object.entries(env ?? {}).map(([key, value]) => ({
		key,
		value,
	}));
}

function serializeEnvEntries(entries: readonly EnvVariable[]): Record<string, string> | undefined {
	const nextEnv: Record<string, string> = {};

	for (const entry of entries) {
		const key = entry.key.trim();
		if (!key) continue;
		nextEnv[key] = entry.value.trim();
	}

	return Object.keys(nextEnv).length > 0 ? nextEnv : undefined;
}

const TYPE_LABELS = { http: 'Remote (HTTP)', stdio: 'Local (command)' } as const;
const ITEM_CLASS = 'border-b border-border/60 px-5 py-4';
const CONTROL_CLASS = 'h-8 w-full text-xs';
const CONTROL_ACTIONS_CLASS = 'ml-auto w-full flex-none justify-end sm:w-64';

function McpFormItem({
	title,
	description,
	children,
}: {
	readonly title: React.ReactNode;
	readonly description: React.ReactNode;
	readonly children?: React.ReactNode;
}): React.JSX.Element {
	return (
		<Item variant="outline" size="md" className={ITEM_CLASS}>
			<ItemContent className="min-w-0 flex-col items-start gap-0.5">
				<ItemTitle>{title}</ItemTitle>
				<p className="text-[11px] leading-4 text-muted-foreground">{description}</p>
			</ItemContent>
			{children && <ItemActions className={CONTROL_ACTIONS_CLASS}>{children}</ItemActions>}
		</Item>
	);
}

export function McpServerForm({
	initial,
	onSubmit,
	onCancel,
	action,
}: {
	readonly initial?: { readonly id: string; readonly entry: McpData };
	readonly onSubmit: (id: string, entry: McpData) => Promise<void>;
	readonly onCancel: () => void;
	readonly action?: React.ReactNode;
}): React.JSX.Element {
	const isEdit = Boolean(initial);
	const entry = initial?.entry;
	const [type, setType] = useState<McpData['type']>(entry?.type ?? 'http');
	const [id, setId] = useState(initial?.id ?? '');
	const [name, setName] = useState(entry?.name ?? '');
	const [url, setUrl] = useState(entry?.type === 'http' ? entry.url : '');
	const [token, setToken] = useState(entry?.type === 'http' ? (entry.token ?? '') : '');
	const [clientId, setClientId] = useState(entry?.type === 'http' ? (entry.client_id ?? '') : '');
	const [clientSecret, setClientSecret] = useState(
		entry?.type === 'http' ? (entry.client_secret ?? '') : ''
	);
	const [command, setCommand] = useState(entry?.type === 'stdio' ? entry.command : '');
	const [args, setArgs] = useState(entry?.type === 'stdio' ? (entry.args?.join(' ') ?? '') : '');
	const [env, setEnv] = useState<EnvVariable[]>(
		entry?.type === 'stdio' ? parseEnvEntries(entry.env) : []
	);
	const [envKey, setEnvKey] = useState('');
	const [envValue, setEnvValue] = useState('');
	const [cwd, setCwd] = useState(entry?.type === 'stdio' ? (entry.cwd ?? '') : '');
	const [approval, setApproval] = useState<'default' | 'always' | 'never'>(
		entry?.require_approval ?? 'default'
	);
	const [deferLoading, setDeferLoading] = useState(entry?.defer_loading ?? false);
	const [error, setError] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);

	const serverId = id.trim().toLowerCase();
	const isGitHubRemote = type === 'http' && isGitHubRemoteMcpUrl(url);
	const isGoogleRemote = type === 'http' && Boolean(googleMcpScopes(url));

	const buildEntry = (): McpData => {
		const now = new Date().toISOString();
		const base = {
			name: name.trim() || undefined,
			require_approval: approval === 'default' ? undefined : approval,
			defer_loading: deferLoading || undefined,
			enabled: initial?.entry.enabled ?? true,
			created_at: initial?.entry.created_at ?? now,
			updated_at: now,
		};
		return type === 'http'
			? {
					...(initial?.entry.type === 'http' ? initial.entry : {}),
					...base,
					type: 'http',
					url: url.trim(),
					token: isGoogleRemote ? undefined : token.trim() || undefined,
					client_id: isGoogleRemote ? undefined : clientId.trim() || undefined,
					client_secret: isGoogleRemote ? undefined : clientSecret.trim() || undefined,
				}
			: {
					...(initial?.entry.type === 'stdio' ? initial.entry : {}),
					...base,
					type: 'stdio',
					command: command.trim(),
					// ponytail: args split on whitespace; quoted arguments not supported
					args: args.trim() ? args.trim().split(/\s+/) : undefined,
					env: serializeEnvEntries(env),
					cwd: cwd.trim() || undefined,
				};
	};

	const addEnvironmentVariable = (): void => {
		const nextKey = envKey.trim();
		if (!nextKey) return;
		setEnv((current) => [...current, { key: nextKey, value: envValue }]);
		setEnvKey('');
		setEnvValue('');
	};

	const removeEnvironmentVariable = (indexToRemove: number): void => {
		setEnv((current) => current.filter((_, index) => index !== indexToRemove));
	};

	const updateEnvironmentVariable = (indexToUpdate: number, patch: Partial<EnvVariable>): void => {
		setEnv((current) =>
			current.map((entry, index) => (index === indexToUpdate ? { ...entry, ...patch } : entry))
		);
	};

	const isValid = Boolean(serverId && (type === 'http' ? url.trim() : command.trim()));
	const submit = async (event: React.FormEvent): Promise<void> => {
		event.preventDefault();
		if (!isValid) {
			setError(
				type === 'http' ? 'ID and server URL are required.' : 'ID and command are required.'
			);
			return;
		}
		setSaving(true);
		setError(null);
		try {
			await onSubmit(serverId, buildEntry());
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setSaving(false);
		}
	};

	// ponytail: OAuth needs the server in the store first, so persist before starting
	const persist = async (): Promise<void> => {
		await window.mcp.upsert(serverId, buildEntry());
	};

	return (
		<form onSubmit={submit}>
			<Item variant="outline" size="md" className={ITEM_CLASS}>
				<ItemContent className="min-w-0 flex-col items-start gap-0.5">
					<ItemTitle>
						<Label htmlFor="mcp-type">Type</Label>
					</ItemTitle>
					<p className="text-[11px] leading-4 text-muted-foreground">
						Choose a remote HTTP service or a local command.
					</p>
				</ItemContent>
				<ItemActions className={CONTROL_ACTIONS_CLASS}>
					<Select
						value={type}
						onValueChange={(value) => setType(value as McpData['type'])}
						disabled={isEdit}
					>
						<SelectTrigger id="mcp-type" size="sm" className="w-full">
							<SelectValue>{TYPE_LABELS[type]}</SelectValue>
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="http">{TYPE_LABELS.http}</SelectItem>
							<SelectItem value="stdio">{TYPE_LABELS.stdio}</SelectItem>
						</SelectContent>
					</Select>
				</ItemActions>
			</Item>
			<Item variant="outline" size="md" className={ITEM_CLASS}>
				<ItemContent className="min-w-0 flex-col items-start gap-0.5">
					<ItemTitle>
						<Label htmlFor="mcp-id">ID</Label>
					</ItemTitle>
					<p className="text-[11px] leading-4 text-muted-foreground">
						Use a unique identifier for this server.
					</p>
				</ItemContent>
				<ItemActions className={CONTROL_ACTIONS_CLASS}>
					<Input
						id="mcp-id"
						value={id}
						disabled={isEdit}
						onChange={(e) => setId(e.target.value)}
						placeholder="my-server"
						className={CONTROL_CLASS}
					/>
				</ItemActions>
			</Item>
			<Item variant="outline" size="md" className={ITEM_CLASS}>
				<ItemContent className="min-w-0 flex-col items-start gap-0.5">
					<ItemTitle>
						<Label htmlFor="mcp-name">Name</Label>
					</ItemTitle>
					<p className="text-[11px] leading-4 text-muted-foreground">
						Shown in the MCP servers list.
					</p>
				</ItemContent>
				<ItemActions className={CONTROL_ACTIONS_CLASS}>
					<Input
						id="mcp-name"
						value={name}
						onChange={(e) => setName(e.target.value)}
						placeholder="My Server"
						className={CONTROL_CLASS}
					/>
				</ItemActions>
			</Item>
			<Item variant="outline" size="md" className={ITEM_CLASS}>
				<ItemContent className="min-w-0 flex-col items-start gap-0.5">
					<ItemTitle>
						<Label htmlFor="mcp-approval">Tool approval</Label>
					</ItemTitle>
					<p className="text-[11px] leading-4 text-muted-foreground">
						Choose when Kucedr asks before using this server’s tools.
					</p>
				</ItemContent>
				<ItemActions className={CONTROL_ACTIONS_CLASS}>
					<Select
						value={approval}
						onValueChange={(value) => setApproval(value as 'default' | 'always' | 'never')}
					>
						<SelectTrigger id="mcp-approval" size="sm" className="w-full">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="default">Default</SelectItem>
							<SelectItem value="always">Always require approval</SelectItem>
							<SelectItem value="never">Never require approval</SelectItem>
						</SelectContent>
					</Select>
				</ItemActions>
			</Item>
			<Item variant="outline" size="md" className={ITEM_CLASS}>
				<ItemContent className="min-w-0 flex-col items-start gap-0.5">
					<ItemTitle>Defer tool loading</ItemTitle>
					<p className="text-[11px] leading-4 text-muted-foreground">
						Load this server’s tools only when needed.
					</p>
				</ItemContent>
				<ItemActions className="ml-auto flex-none justify-end">
					<Switch
						checked={deferLoading}
						onCheckedChange={setDeferLoading}
						aria-label="Defer tool loading"
					/>
				</ItemActions>
			</Item>

			{type === 'http' ? (
				<>
					<McpFormItem
						title={<Label htmlFor="mcp-url">Server URL</Label>}
						description="The MCP endpoint Kucedr connects to."
					>
						<Input
							id="mcp-url"
							value={url}
							onChange={(e) => setUrl(e.target.value)}
							placeholder="https://example.com/mcp"
							className={CONTROL_CLASS}
						/>
					</McpFormItem>
					{isGitHubRemote ? (
						<McpFormItem
							title={<Label htmlFor="mcp-token">GitHub personal access token</Label>}
							description="GitHub remote MCP requires a bearer token."
						>
							<div className="flex w-full flex-col items-stretch gap-2">
								<Input
									id="mcp-token"
									type="password"
									value={token}
									onChange={(e) => setToken(e.target.value)}
									autoComplete="off"
								/>
								<Button
									type="button"
									variant="outline"
									size="sm"
									onClick={() =>
										void window.app.openExternalUrl(
											'https://github.com/settings/personal-access-tokens/new'
										)
									}
								>
									Create GitHub token
								</Button>
							</div>
						</McpFormItem>
					) : isEdit && isValid ? (
						<McpFormItem title="Authentication" description="Connect this server with OAuth.">
							<McpOAuthButton id={serverId} beforeStart={persist} />
						</McpFormItem>
					) : (
						<McpFormItem
							title="Authentication"
							description="Save the server before connecting with OAuth."
						/>
					)}
					{!isGoogleRemote && (
						<details className="p-4">
							<summary className="cursor-pointer text-[13px] text-muted-foreground">
								Advanced
							</summary>
							<div className="mt-3 divide-y divide-border/60 border-y border-border/60">
								<p className="text-[12px] text-muted-foreground">
									The default OAuth callback is http://127.0.0.1:3001/oauth/callback. Register this
									URL if your authorization server requires it. To use another loopback URL, set
									CLIENT_REDIRECT_URL in .env and restart Kucedr.
								</p>
								{!isGitHubRemote && (
									<SettingsRow
										className="border-b-0! px-0!"
										title={<Label htmlFor="mcp-token">Access token (optional)</Label>}
										actions={
											<Input
												id="mcp-token"
												type="password"
												value={token}
												onChange={(e) => setToken(e.target.value)}
												autoComplete="off"
												className="sm:w-80"
											/>
										}
									/>
								)}
								<>
									<SettingsRow
										className="border-b-0! px-0!"
										title={<Label htmlFor="mcp-client-id">Client ID (optional)</Label>}
										actions={
											<Input
												id="mcp-client-id"
												value={clientId}
												onChange={(e) => setClientId(e.target.value)}
												autoComplete="off"
												className="sm:w-80"
											/>
										}
									/>
									<SettingsRow
										className="border-b-0! px-0!"
										title={<Label htmlFor="mcp-client-secret">Client secret (optional)</Label>}
										actions={
											<Input
												id="mcp-client-secret"
												type="password"
												placeholder={isEdit ? 'Leave blank to keep the saved secret' : undefined}
												value={clientSecret}
												onChange={(e) => setClientSecret(e.target.value)}
												autoComplete="off"
												className="sm:w-80"
											/>
										}
									/>
								</>
							</div>
						</details>
					)}
				</>
			) : (
				<>
					<SettingsRow
						className="border-b-0!"
						title={<Label htmlFor="mcp-command">Command</Label>}
						actions={
							<Input
								id="mcp-command"
								value={command}
								onChange={(e) => setCommand(e.target.value)}
								placeholder="npx"
								autoComplete="off"
								className="sm:w-80"
							/>
						}
					/>
					<SettingsRow
						className="border-b-0!"
						title={<Label htmlFor="mcp-args">Arguments (optional)</Label>}
						actions={
							<Input
								id="mcp-args"
								value={args}
								onChange={(e) => setArgs(e.target.value)}
								placeholder="-y @modelcontextprotocol/server-filesystem /tmp"
								autoComplete="off"
								className="sm:w-80"
							/>
						}
					/>
					<SettingsRow
						className="border-b-0!"
						title={<Label htmlFor="mcp-env-key">Environment variables (optional)</Label>}
						actions={
							<div className="grid w-full gap-2 sm:w-80">
								{env.map((entry, index) => (
									<div
										key={`${entry.key}-${index}`}
										className="grid grid-cols-[1fr_1fr_auto] gap-2"
									>
										<Input
											id={`mcp-env-key-${index}`}
											aria-label="Key"
											value={entry.key}
											onChange={(e) => updateEnvironmentVariable(index, { key: e.target.value })}
											autoComplete="off"
											placeholder="KEY"
											spellCheck={false}
										/>
										<Input
											id={`mcp-env-value-${index}`}
											aria-label="Value"
											value={entry.value}
											onChange={(e) => updateEnvironmentVariable(index, { value: e.target.value })}
											autoComplete="off"
											placeholder="VALUE"
											spellCheck={false}
										/>
										<div className="flex items-end">
											<Button
												type="button"
												variant="ghost"
												size="icon-sm"
												className="h-8 w-8"
												aria-label={`Remove ${entry.key || 'environment'} variable`}
												onClick={() => removeEnvironmentVariable(index)}
											>
												<Trash2 className="size-3.5" />
											</Button>
										</div>
									</div>
								))}
								<div className="mt-1 grid grid-cols-[1fr_1fr_auto] gap-2">
									<Input
										id="mcp-env-key"
										aria-label="Environment variables (optional)"
										value={envKey}
										onChange={(e) => setEnvKey(e.target.value)}
										placeholder="KEY"
										autoComplete="off"
										spellCheck={false}
									/>
									<Input
										id="mcp-env-value"
										aria-label="Value"
										value={envValue}
										onChange={(e) => setEnvValue(e.target.value)}
										placeholder="VALUE"
										autoComplete="off"
										spellCheck={false}
										onKeyDown={(event) => {
											if (event.key === 'Enter') {
												event.preventDefault();
												addEnvironmentVariable();
											}
										}}
									/>
									<div className="flex items-end">
										<Button
											type="button"
											size="sm"
											className="h-8"
											disabled={!envKey.trim()}
											onClick={addEnvironmentVariable}
											aria-label="Add environment variable"
										>
											<Plus className="size-3.5" />
											Add
										</Button>
									</div>
								</div>
							</div>
						}
					/>
					<SettingsRow
						className="border-b-0!"
						title={<Label htmlFor="mcp-cwd">Working directory (optional)</Label>}
						actions={
							<Input
								id="mcp-cwd"
								value={cwd}
								onChange={(e) => setCwd(e.target.value)}
								placeholder="/path/to/server"
								autoComplete="off"
								className="sm:w-80"
							/>
						}
					/>
				</>
			)}

			{type === 'stdio' && (
				<p className="text-[13px] text-muted-foreground">
					Saved local MCP commands run with your desktop account's privileges. Tool approvals apply
					after the server launches.
				</p>
			)}
			{error && <p className="text-[13px] text-destructive">{error}</p>}

			<div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 px-5 py-3">
				<div className="flex flex-wrap items-center gap-2">{action}</div>
				<div className="ml-auto flex items-center gap-2">
					<Button type="button" variant="ghost" onClick={onCancel}>
						Cancel
					</Button>
					<Button type="submit" disabled={saving}>
						{saving ? 'Saving' : type === 'stdio' ? 'Save' : isEdit ? 'Save' : 'Add MCP server'}
					</Button>
				</div>
			</div>
		</form>
	);
}
