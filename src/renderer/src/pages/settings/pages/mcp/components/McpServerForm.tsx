import React, { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { McpData } from '@shared/mcp_types';
import { Button } from '@/components/ui/button';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
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
const SMALL_INPUT_CLASS = 'h-8 text-sm';

export function McpServerForm({
	initial,
	onSubmit,
	onCancel,
	onRemove,
}: {
	readonly initial?: { readonly id: string; readonly entry: McpData };
	readonly onSubmit: (id: string, entry: McpData) => Promise<void>;
	readonly onCancel: () => void;
	readonly onRemove?: () => Promise<void>;
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
	const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
	const [deleting, setDeleting] = useState(false);

	const serverId = id.trim().toLowerCase();

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
					token: token.trim() || undefined,
					client_id: clientId.trim() || undefined,
					client_secret: clientSecret.trim() || undefined,
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
	const serverName = entry?.name ?? id;

	const confirmDelete = async (): Promise<void> => {
		if (!onRemove) return;
		setDeleting(true);
		try {
			await onRemove();
			setConfirmDeleteOpen(false);
		} finally {
			setDeleting(false);
		}
	};

	const removeAction = (): React.JSX.Element | null => {
		if (!onRemove) return null;

		return (
			<Dialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
				<div className="border-t border-border pt-4">
					<Button
						type="button"
						variant="destructive"
						size="sm"
						onClick={() => setConfirmDeleteOpen(true)}
					>
						<Trash2 className="size-3.5" />
						Remove MCP server
					</Button>
				</div>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Delete MCP server</DialogTitle>
						<DialogDescription>
							Remove <span className="font-medium text-foreground">{serverName}</span>? This cannot
							be undone.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button type="button" variant="outline" onClick={() => setConfirmDeleteOpen(false)}>
							Cancel
						</Button>
						<Button
							type="button"
							variant="destructive"
							onClick={() => void confirmDelete()}
							disabled={deleting}
						>
							Delete
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		);
	};

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
		<form onSubmit={submit} className="grid gap-4">
			<Field>
				<Label htmlFor="mcp-type">Type</Label>
				<Select
					value={type}
					onValueChange={(value) => setType(value as McpData['type'])}
					disabled={isEdit}
				>
					<SelectTrigger id="mcp-type" className="w-full">
						<SelectValue>{TYPE_LABELS[type]}</SelectValue>
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="http">{TYPE_LABELS.http}</SelectItem>
						<SelectItem value="stdio">{TYPE_LABELS.stdio}</SelectItem>
					</SelectContent>
				</Select>
			</Field>
			<Field>
				<Label htmlFor="mcp-id">ID</Label>
				<Input
					id="mcp-id"
					value={id}
					disabled={isEdit}
					onChange={(e) => setId(e.target.value)}
					placeholder="my-server"
					className={SMALL_INPUT_CLASS}
				/>
			</Field>
			<Field>
				<Label htmlFor="mcp-name">Name</Label>
				<Input
					id="mcp-name"
					value={name}
					onChange={(e) => setName(e.target.value)}
					placeholder="My Server"
					className={SMALL_INPUT_CLASS}
				/>
			</Field>
			<Field>
				<Label htmlFor="mcp-approval">Tool approval</Label>
				<Select
					value={approval}
					onValueChange={(value) => setApproval(value as 'default' | 'always' | 'never')}
				>
					<SelectTrigger id="mcp-approval" className="w-full">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="default">Default</SelectItem>
						<SelectItem value="always">Always require approval</SelectItem>
						<SelectItem value="never">Never require approval</SelectItem>
					</SelectContent>
				</Select>
			</Field>
			<label className="flex items-center justify-between gap-3 rounded-md border border-border px-4 py-3">
				<span>
					<span className="block text-[13px] font-medium text-foreground">Defer tool loading</span>
					<span className="block text-[11px] text-muted-foreground">
						Load this server’s tools only when needed.
					</span>
				</span>
				<Switch
					checked={deferLoading}
					onCheckedChange={setDeferLoading}
					aria-label="Defer tool loading"
				/>
			</label>

			{type === 'http' ? (
				<>
					<Field>
						<Label htmlFor="mcp-url">Server URL</Label>
						<Input
							id="mcp-url"
							value={url}
							onChange={(e) => setUrl(e.target.value)}
							placeholder="https://example.com/mcp"
							className={SMALL_INPUT_CLASS}
						/>
					</Field>
					{isEdit && isValid ? (
						<McpOAuthButton id={serverId} beforeStart={persist} />
					) : (
						<p className="text-[12px] text-muted-foreground">
							Save the server before connecting with OAuth.
						</p>
					)}
					<details>
						<summary className="cursor-pointer text-[13px] text-muted-foreground">Advanced</summary>
						<div className="grid gap-4 pt-4">
							<Field>
								<Label htmlFor="mcp-token">Access token (optional)</Label>
								<Input
									id="mcp-token"
									type="password"
									value={token}
									onChange={(e) => setToken(e.target.value)}
									autoComplete="off"
									className={SMALL_INPUT_CLASS}
								/>
							</Field>
							<Field>
								<Label htmlFor="mcp-client-id">Client ID (optional)</Label>
								<Input
									id="mcp-client-id"
									value={clientId}
									onChange={(e) => setClientId(e.target.value)}
									autoComplete="off"
									className={SMALL_INPUT_CLASS}
								/>
							</Field>
							<Field>
								<Label htmlFor="mcp-client-secret">Client secret (optional)</Label>
								<Input
									id="mcp-client-secret"
									type="password"
									value={clientSecret}
									onChange={(e) => setClientSecret(e.target.value)}
									autoComplete="off"
									className={SMALL_INPUT_CLASS}
								/>
							</Field>
							{removeAction()}
						</div>
					</details>
				</>
			) : (
				<>
					<Field>
						<Label htmlFor="mcp-command">Command</Label>
						<Input
							id="mcp-command"
							value={command}
							onChange={(e) => setCommand(e.target.value)}
							placeholder="npx"
							autoComplete="off"
							className={SMALL_INPUT_CLASS}
						/>
					</Field>
					<Field>
						<Label htmlFor="mcp-args">Arguments (optional)</Label>
						<Input
							id="mcp-args"
							value={args}
							onChange={(e) => setArgs(e.target.value)}
							placeholder="-y @modelcontextprotocol/server-filesystem /tmp"
							autoComplete="off"
							className={SMALL_INPUT_CLASS}
						/>
					</Field>
					<Field>
						<Label htmlFor="mcp-env-key">Environment variables (optional)</Label>
						<div className="grid gap-2">
							{env.map((entry, index) => (
								<div key={`${entry.key}-${index}`} className="grid grid-cols-[1fr_1fr_auto] gap-2">
									<Field className="mb-0">
										<Label
											htmlFor={`mcp-env-key-${index}`}
											className="text-xs text-muted-foreground"
										>
											Key
										</Label>
										<Input
											id={`mcp-env-key-${index}`}
											value={entry.key}
											onChange={(e) => updateEnvironmentVariable(index, { key: e.target.value })}
											autoComplete="off"
											placeholder="KEY"
											spellCheck={false}
											className={SMALL_INPUT_CLASS}
										/>
									</Field>
									<Field className="mb-0">
										<Label
											htmlFor={`mcp-env-value-${index}`}
											className="text-xs text-muted-foreground"
										>
											Value
										</Label>
										<Input
											id={`mcp-env-value-${index}`}
											value={entry.value}
											onChange={(e) => updateEnvironmentVariable(index, { value: e.target.value })}
											autoComplete="off"
											placeholder="VALUE"
											spellCheck={false}
											className={SMALL_INPUT_CLASS}
										/>
									</Field>
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
								<Field className="mb-0">
									<Label htmlFor="mcp-env-key" className="text-xs text-muted-foreground">
										Key
									</Label>
									<Input
										id="mcp-env-key"
										value={envKey}
										onChange={(e) => setEnvKey(e.target.value)}
										placeholder="KEY"
										autoComplete="off"
										spellCheck={false}
										className={SMALL_INPUT_CLASS}
									/>
								</Field>
								<Field className="mb-0">
									<Label htmlFor="mcp-env-value" className="text-xs text-muted-foreground">
										Value
									</Label>
									<Input
										id="mcp-env-value"
										value={envValue}
										onChange={(e) => setEnvValue(e.target.value)}
										placeholder="VALUE"
										autoComplete="off"
										spellCheck={false}
										className={SMALL_INPUT_CLASS}
										onKeyDown={(event) => {
											if (event.key === 'Enter') {
												event.preventDefault();
												addEnvironmentVariable();
											}
										}}
									/>
								</Field>
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
					</Field>
					<Field>
						<Label htmlFor="mcp-cwd">Working directory (optional)</Label>
						<Input
							id="mcp-cwd"
							value={cwd}
							onChange={(e) => setCwd(e.target.value)}
							placeholder="/path/to/server"
							autoComplete="off"
							className={SMALL_INPUT_CLASS}
						/>
					</Field>
					{onRemove && (
						<details>
							<summary className="cursor-pointer text-[13px] text-muted-foreground">
								Advanced
							</summary>
							{removeAction()}
						</details>
					)}
				</>
			)}

			{type === 'stdio' && (
				<p className="text-[13px] text-muted-foreground">
					Saving trusts this command, its arguments, environment and working directory to run with
					your desktop account's privileges. Tool approvals apply after the server launches.
				</p>
			)}
			{error && <p className="text-[13px] text-destructive">{error}</p>}

			<div className="flex justify-end gap-2">
				<Button type="button" variant="ghost" onClick={onCancel}>
					Cancel
				</Button>
				<Button type="submit" disabled={saving}>
					{saving
						? 'Saving'
						: type === 'stdio'
							? 'Save and trust'
							: isEdit
								? 'Save'
								: 'Add MCP server'}
				</Button>
			</div>
		</form>
	);
}
