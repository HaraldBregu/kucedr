import type { MemoryConfig, MemoryService, MemoryStatus } from '../../shared/memory_types';
import type { MemoryDependencies, MemoryState, SourceSession } from './types';
import { extract } from './extract';
import { mergeMemories } from './merge';
import { parseMemories } from './parse';
import { recall } from './recall';

export class Memory implements MemoryService {
	private state: MemoryState;
	private active?: Promise<MemoryStatus>;
	private controller?: AbortController;
	private task?: { stop(): void };
	private queue: Promise<unknown> = Promise.resolve();
	private revision = 0;
	private stopped = false;
	private error: string | null = null;
	private pending = 0;

	constructor(private readonly dependencies: MemoryDependencies) {
		this.state = structuredClone(dependencies.store.load());
	}

	getConfig(): MemoryConfig { return structuredClone(this.state.config); }
	status(): MemoryStatus {
		return { running: Boolean(this.active), lastSuccess: this.state.lastSuccess, error: this.error, pending: this.pending };
	}
	read(): Promise<string> { return this.dependencies.read(); }
	async list() {
		return [...new Map(parseMemories(await this.read()).map(({ id, fact }) => [id, { id, fact }])).values()];
	}
	async context(query: string): Promise<string> { return recall(await this.read(), query); }

	async configure(patch: Partial<MemoryConfig>): Promise<MemoryConfig> {
		const config = { ...this.getConfig(), ...patch };
		if ((patch.providerId !== undefined && patch.providerId !== this.state.config.providerId) ||
			(patch.modelId !== undefined && patch.modelId !== this.state.config.modelId)) {
			config.modelOptions = patch.modelOptions ?? {};
		}
		this.dependencies.validate(config);
		this.invalidate();
		await this.lock(async () => {
			this.persist({ ...this.state, config, modelInitialized: Boolean(config.providerId && config.modelId) || this.state.modelInitialized });
			this.reschedule();
		});
		return this.getConfig();
	}

	async start(): Promise<void> {
		this.stopped = false;
		await this.initialize();
		this.reschedule();
		await this.refresh('startup');
	}
	async stop(): Promise<void> {
		this.stopped = true;
		this.task?.stop();
		this.task = undefined;
		this.invalidate();
		await this.active;
		await this.queue;
	}
	refresh(trigger: 'manual' | 'startup' | 'wake' | 'cron' = 'manual'): Promise<MemoryStatus> {
		if (this.active) return this.active;
		if (this.stopped || (trigger !== 'manual' && !this.state.config.enabled)) return Promise.resolve(this.status());
		this.controller = new AbortController();
		const signal = AbortSignal.any([this.controller.signal, AbortSignal.timeout(5 * 60_000)]);
		this.error = null;
		this.active = this.process(signal).catch((error: unknown) => {
			if (!this.controller?.signal.aborted) this.error = error instanceof Error ? error.message : 'Memory refresh failed.';
		}).then(() => {
			this.active = undefined;
			this.controller = undefined;
			return this.status();
		});
		return this.active;
	}

	async edit(markdown: string): Promise<void> {
		if (typeof markdown !== 'string' || markdown.length > 2_000_000) throw new Error('Invalid memory document.');
		this.invalidate();
		await this.lock(async () => {
			const previous = parseMemories(await this.read());
			const kept = new Set(parseMemories(markdown).map((entry) => entry.id));
			await this.replace(markdown, previous.filter((entry) => !kept.has(entry.id)).map((entry) => entry.id));
		});
	}
	async forget(id: string): Promise<{ removed: boolean }> {
		if (!/^memory-[a-f0-9]{16}$/i.test(id)) throw new Error('A valid memory ID is required.');
		this.invalidate();
		return this.lock(async () => {
			const markdown = await this.read();
			const lines = new Set(parseMemories(markdown).filter((entry) => entry.id === id.toLowerCase()).map((entry) => entry.lineIndex));
			if (!lines.size) return { removed: false };
			await this.replace(markdown.split('\n').filter((_line, index) => !lines.has(index)).join('\n'), [id.toLowerCase()]);
			return { removed: true };
		});
	}
	async clear(): Promise<void> {
		this.invalidate();
		await this.lock(async () => this.replace('', parseMemories(await this.read()).map((entry) => entry.id)));
	}

	private async replace(markdown: string, suppressed: string[]): Promise<void> {
		const sources = await this.dependencies.sources();
		const state = { ...this.state, initialized: true,
			checkpoints: Object.fromEntries(sources.map((source) => [source.id, source.messages.map((message) => message.fingerprint)])),
			suppressed: [...new Set([...this.state.suppressed, ...suppressed])] };
		await this.dependencies.write(markdown);
		this.persist(state);
		this.pending = 0;
	}
	private invalidate(): void { this.revision += 1; this.controller?.abort(); }
	private persist(state: MemoryState): void {
		this.dependencies.store.save(structuredClone(state));
		this.state = state;
	}
	private lock<T>(operation: () => Promise<T>): Promise<T> {
		const result = this.queue.then(operation);
		this.queue = result.catch(() => undefined);
		return result;
	}
	private reschedule(): void {
		this.task?.stop();
		this.task = undefined;
		const config = this.state.config;
		if (!this.stopped && config.enabled && config.scheduleEnabled) {
			this.task = this.dependencies.schedule(config.cronExpression, config.timezone, async () => { await this.refresh('cron'); });
		}
	}
	private async initialize(): Promise<void> {
		await this.lock(async () => {
			let state = this.state;
			if (!state.initialized) {
				const sources = await this.dependencies.sources();
				state = { ...state, initialized: true, checkpoints: Object.fromEntries(sources.map((source) => [source.id, source.messages.map((message) => message.fingerprint)])) };
			}
			if (!state.modelInitialized) {
				const selection = this.dependencies.selection();
				if (selection.providerId && selection.modelId) {
					const config = { ...state.config, ...selection };
					this.dependencies.validate(config);
					state = { ...state, config, modelInitialized: true };
				}
			}
			if (state !== this.state) this.persist(state);
		});
	}
	private async process(signal: AbortSignal): Promise<void> {
		await this.initialize();
		signal.throwIfAborted();
		const config = this.getConfig();
		if (!config.providerId || !config.modelId) return;
		this.dependencies.validate(config);
		const sources = await this.dependencies.sources();
		this.pending = sources.reduce((total, source) => total + source.messages.filter((message) => !this.state.checkpoints[source.id]?.includes(message.fingerprint)).length, 0);
		let batches = 0;
		for (const source of sources) {
			let pending = source.messages.filter((message) => !this.state.checkpoints[source.id]?.includes(message.fingerprint));
			while (pending.length && batches < 20) {
				signal.throwIfAborted();
				const batch = [] as SourceSession['messages'];
				let size = 0;
				for (const message of pending) {
					if (batch.length && (size + message.text.length > 12_000 || batch.length >= 24)) break;
					batch.push(message); size += message.text.length;
				}
				const revision = this.revision;
				const markdown = await this.read();
				const entries = await extract(this.dependencies, config, batch, parseMemories(markdown), signal);
				batches += 1;
				const committed = await this.lock(async () => {
					signal.throwIfAborted();
					if (revision !== this.revision || markdown !== await this.read()) return false;
					const current = (await this.dependencies.sources()).find((item) => item.id === source.id);
					if (!current || JSON.stringify(current) !== JSON.stringify(source)) return false;
					const next = mergeMemories(markdown, entries, this.state.suppressed);
					await this.dependencies.write(next);
					const processed = new Set([...(this.state.checkpoints[source.id] ?? []), ...batch.map((message) => message.fingerprint)]);
					this.persist({ ...this.state, checkpoints: { ...this.state.checkpoints, [source.id]: source.messages.map((message) => message.fingerprint).filter((value) => processed.has(value)) } });
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
