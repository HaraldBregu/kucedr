import type {
	MemoryConfig,
	MemoryMessage,
	MemoryService,
	MemoryStatus,
} from '../../shared/memory_types';
import type { MemoryDependencies, MemoryState, SourceMessage } from './types';
import { parseMemories } from './parse';
import { recall } from './recall';
import { fingerprint } from './fingerprint';
import { snapshotMarkdown } from './snapshot';
import { generateMemory } from './generate';
import { stampMemories } from './stamp';
import { baseline } from './baseline';

export class Memory implements MemoryService {
	private state: MemoryState;
	private active?: Promise<MemoryStatus>;
	private controller?: AbortController;
	private changedSessions = new Set<string>();
	private drain?: Promise<void>;
	private queue: Promise<unknown> = Promise.resolve();
	private revision = 0;
	private started = false;
	private stopped = false;
	private error: string | null = null;
	private pending = 0;

	constructor(private readonly dependencies: MemoryDependencies) {
		const state = structuredClone(dependencies.store.load());
		this.state = {
			...state,
			config: {
				enabled: state.config.enabled,
				includeInPrompt: state.config.includeInPrompt ?? true,
				providerId: state.config.providerId,
				modelId: state.config.modelId,
				modelOptions: state.config.modelOptions,
				memoryType: state.config.memoryType,
			},
		};
		if (
			'scheduleEnabled' in state.config ||
			'cronExpression' in state.config ||
			'timezone' in state.config
		)
			dependencies.store.save(structuredClone(this.state));
	}

	getConfig(): MemoryConfig {
		return structuredClone(this.state.config);
	}
	status(): MemoryStatus {
		return {
			running: Boolean(this.active),
			lastSuccess: this.state.lastSuccess,
			error: this.error,
			pending: this.pending,
		};
	}
	read(): Promise<string> {
		return this.dependencies.read();
	}
	async list() {
		return [
			...new Map(
				parseMemories(await this.read()).map(({ id, fact, createdAt }) => [
					id,
					{ id, fact, ...(createdAt ? { createdAt } : {}) },
				])
			).values(),
		];
	}
	async context(query: string): Promise<string> {
		if (!this.state.config.includeInPrompt) return '';
		return recall(await this.read(), query);
	}
	async capture(sessionId: string, messages: readonly MemoryMessage[]): Promise<void> {
		const id = sessionId.toLowerCase();
		const markdown = snapshotMarkdown(id, messages);
		await this.lock(() => this.dependencies.writeSession(id, markdown));
		this.enqueueSession(id);
	}
	async remove(sessionId: string): Promise<void> {
		const id = sessionId.toLowerCase();
		await this.lock(async () => {
			await this.dependencies.removeSession(id);
			const { [id]: _removed, ...checkpoints } = this.state.checkpoints;
			this.persist({ ...this.state, checkpoints });
		});
	}

	async configure(patch: Partial<MemoryConfig>): Promise<MemoryConfig> {
		return this.lock(async () => {
			const config = { ...this.getConfig(), ...patch };
			if (
				(patch.providerId !== undefined && patch.providerId !== this.state.config.providerId) ||
				(patch.modelId !== undefined && patch.modelId !== this.state.config.modelId)
			) {
				config.modelOptions = patch.modelOptions ?? {};
			}
			this.dependencies.validate(config);
			this.invalidate();
			this.persist({
				...this.state,
				config,
				modelInitialized:
					Boolean(config.providerId && config.modelId) || this.state.modelInitialized,
			});
			return this.getConfig();
		});
	}

	async start(): Promise<void> {
		this.stopped = false;
		this.started = true;
		await this.initialize().catch((error: unknown) => {
			this.error = error instanceof Error ? error.message : 'Memory initialization failed.';
		});
		await this.refresh('startup');
	}
	async stop(): Promise<void> {
		this.stopped = true;
		this.started = false;
		this.changedSessions.clear();
		this.invalidate();
		await this.active;
		await this.drain;
		await this.queue;
	}
	refresh(trigger: 'manual' | 'startup' | 'wake' = 'manual'): Promise<MemoryStatus> {
		if (this.active) return this.active;
		if (this.stopped || (trigger !== 'manual' && !this.state.config.enabled))
			return Promise.resolve(this.status());
		return this.run(trigger);
	}

	async edit(markdown: string, expected?: string): Promise<void> {
		if (typeof markdown !== 'string' || markdown.length > 2_000_000)
			throw new Error('Invalid memory document.');
		this.invalidate();
		await this.lock(async () => {
			const current = await this.read();
			if (expected !== undefined && current !== expected)
				throw new Error('Memory changed while editing. Reload before saving.');
			const previous = parseMemories(current);
			const kept = new Set(parseMemories(markdown).map((entry) => entry.id));
			await this.replace(
				stampMemories(markdown, current),
				previous.filter((entry) => !kept.has(entry.id)).map((entry) => entry.id)
			);
		});
	}
	async forget(match: string): Promise<{ removed: number }> {
		const query = match.trim().toLowerCase();
		if (!query) throw new Error('A memory ID or text match is required.');
		this.invalidate();
		return this.lock(async () => {
			const markdown = await this.read();
			const entries = parseMemories(markdown).filter((entry) =>
				query.startsWith('memory-')
					? entry.id === query
					: entry.fact.toLowerCase().includes(query)
			);
			if (!entries.length) return { removed: 0 };
			const lines = new Set(entries.map((entry) => entry.lineIndex));
			await this.replace(
				markdown
					.split('\n')
					.filter((_line, index) => !lines.has(index))
					.join('\n'),
				entries.map((entry) => entry.id)
			);
			return { removed: entries.length };
		});
	}
	async clear(): Promise<void> {
		this.invalidate();
		await this.lock(async () =>
			this.replace(
				'',
				parseMemories(await this.read()).map((entry) => entry.id),
				true
			)
		);
	}

	private async replace(markdown: string, suppressed: string[], reset = false): Promise<void> {
		const present = new Set(parseMemories(markdown).map((entry) => entry.id));
		const state = {
			...this.state,
			...(reset
				? { initialized: true, checkpoints: baseline(await this.dependencies.sources()) }
				: {}),
			suppressed: [...new Set([...this.state.suppressed, ...suppressed])].filter(
				(id) => !present.has(id)
			),
		};
		this.persist({
			...this.state,
			mutation: {
				digest: fingerprint(markdown),
				checkpoints: state.checkpoints,
				suppressed: state.suppressed,
			},
		});
		try {
			await this.dependencies.write(markdown);
		} catch (error) {
			const { mutation: _mutation, ...previous } = this.state;
			this.persist(previous);
			throw error;
		}
		const { mutation: _mutation, ...committed } = state;
		this.persist(committed);
		if (reset) this.pending = 0;
	}
	private invalidate(): void {
		this.revision += 1;
		this.controller?.abort();
	}
	private persist(state: MemoryState): void {
		this.dependencies.store.save(structuredClone(state));
		this.state = state;
	}
	private lock<T>(operation: () => Promise<T>): Promise<T> {
		const result = this.queue.then(operation);
		this.queue = result.catch(() => undefined);
		return result;
	}
	private run(
		trigger: 'manual' | 'startup' | 'wake' | 'capture',
		sessionId?: string
	): Promise<MemoryStatus> {
		const controller = new AbortController();
		const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(5 * 60_000)]);
		this.controller = controller;
		this.error = null;
		this.active = this.process(signal, trigger, sessionId)
			.catch((error: unknown) => {
				if (!controller.signal.aborted)
					this.error = error instanceof Error ? error.message : 'Memory refresh failed.';
			})
			.then(() => {
				this.active = undefined;
				this.controller = undefined;
				return this.status();
			});
		return this.active;
	}
	private enqueueSession(sessionId: string): void {
		if (!this.started || !this.state.config.enabled) return;
		this.changedSessions.add(sessionId);
		if (this.drain) return;
		this.drain = this.drainSessions().finally(() => {
			this.drain = undefined;
			const [next] = this.changedSessions;
			if (next) this.enqueueSession(next);
		});
	}
	private async drainSessions(): Promise<void> {
		while (this.started && this.state.config.enabled && this.changedSessions.size) {
			while (this.active) await this.active;
			if (!this.started || !this.state.config.enabled) return;
			const [sessionId] = this.changedSessions;
			this.changedSessions.delete(sessionId);
			await this.run('capture', sessionId);
		}
	}
	private async initialize(): Promise<void> {
		await this.dependencies.prepare?.();
		await this.lock(async () => {
			let state = this.state;
			if (state.mutation) {
				const { mutation, ...previous } = state;
				state =
					fingerprint(await this.read()) === mutation.digest
						? {
								...previous,
								initialized: true,
								checkpoints: mutation.checkpoints,
								suppressed: mutation.suppressed,
							}
						: previous;
				this.persist(state);
			}
			if (!state.initialized) {
				state = {
					...state,
					initialized: true,
					checkpoints: baseline(await this.dependencies.sources()),
				};
				this.persist(state);
			}
			if (!state.modelInitialized) {
				const selection = this.dependencies.selection();
				if (selection.providerId && selection.modelId) {
					const config = { ...state.config, ...selection };
					try {
						this.dependencies.validate(config);
					} catch {
						return;
					}
					state = { ...state, config, modelInitialized: true };
				}
			}
			if (state !== this.state) this.persist(state);
		});
	}
	private async process(
		signal: AbortSignal,
		trigger: 'manual' | 'startup' | 'wake' | 'capture',
		sessionId?: string
	): Promise<void> {
		const wasInitialized = this.state.initialized;
		await this.initialize();
		signal.throwIfAborted();
		const config = this.getConfig();
		if (!config.providerId || !config.modelId) return;
		this.dependencies.validate(config);
		if (trigger === 'manual' && wasInitialized && !(await this.dependencies.exists())) {
			await this.lock(async () => this.persist({ ...this.state, checkpoints: {} }));
		}
		const queues = (await this.dependencies.sources(sessionId)).map((source) => {
			const processed = new Set(this.state.checkpoints[source.id]);
			return {
				source,
				pending: source.messages.filter((message) => !processed.has(message.fingerprint)),
			};
		});
		this.pending = queues.reduce((total, { pending }) => total + pending.length, 0);
		let batches = 0;
		for (const { source, pending: unprocessed } of queues) {
			let pending = unprocessed;
			while (pending.length && batches < 20) {
				signal.throwIfAborted();
				const batch: SourceMessage[] = [];
				let size = 0;
				for (const message of pending) {
					if (batch.length && (size + message.text.length > 12_000 || batch.length >= 24)) break;
					batch.push(message);
					size += message.text.length;
				}
				const context = source.messages
					.slice(0, source.messages.indexOf(batch[0]))
					.filter((message) => message.role === 'user')
					.slice(-1);
				const revision = this.revision;
				const markdown = await this.read();
				const next = await generateMemory(
					this.dependencies,
					config,
					batch,
					markdown,
					signal,
					context
				);
				batches += 1;
				const committed = await this.lock(async () => {
					signal.throwIfAborted();
					if (revision !== this.revision || markdown !== (await this.read())) return false;
					const [current] = await this.dependencies.sources(source.id);
					if (!current) return false;
					const live = new Set(current.messages.map((message) => message.fingerprint));
					if (![...context, ...batch].every((message) => live.has(message.fingerprint)))
						return false;
					if (next !== undefined) {
						const filtered = next
							.split('\n')
							.filter((line) => {
								const entry = parseMemories(line)[0];
								return !entry || !this.state.suppressed.includes(entry.id);
							})
							.join('\n');
						await this.dependencies.write(stampMemories(filtered, markdown));
					}
					const processed = new Set([
						...(this.state.checkpoints[source.id] ?? []),
						...batch.map((message) => message.fingerprint),
					]);
					this.persist({
						...this.state,
						checkpoints: {
							...this.state.checkpoints,
							[source.id]: current.messages
								.map((message) => message.fingerprint)
								.filter((value) => processed.has(value)),
						},
					});
					this.pending -= batch.length;
					return true;
				});
				if (!committed) break;
				pending = pending.slice(batch.length);
			}
		}
		await this.lock(async () => {
			signal.throwIfAborted();
			this.persist({ ...this.state, lastSuccess: new Date().toISOString() });
		});
	}
}
