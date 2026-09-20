import { fingerprint } from '../../../../../src/main/memory/fingerprint';
import { Memory } from '../../../../../src/main/memory/service';
import type { MemoryDependencies, MemoryState, SourceSession } from '../../../../../src/main/memory/types';

function setup(initialized = true) {
 let state: MemoryState = {
  config: { enabled: true, providerId: 'provider', modelId: 'model', modelOptions: {}, memoryType: 'both' },
  initialized, modelInitialized: true, checkpoints: {}, suppressed: [], lastSuccess: null,
 };
 let markdown = '# Memory\n\nManual notes remain here.\n';
 const sessions: SourceSession[] = [{ id: 'chat', messages: [{ fingerprint: 'first', role: 'user', text: 'I prefer concise answers.' }] }];
	const infer = jest.fn(async () => markdown);
 const write = jest.fn(async (next: string) => { markdown = next; });
	const writeSession = jest.fn(async () => undefined);
	const removeSession = jest.fn(async () => undefined);
	const exists = jest.fn(async () => true);
	const stopWatching = jest.fn();
	let sessionChanged: ((sessionId: string) => void) | undefined;
 const dependencies: MemoryDependencies = {
  store: { load: () => structuredClone(state), save: (next) => { state = structuredClone(next); } },
		sources: jest.fn(async () => structuredClone(sessions)), exists, read: async () => markdown, write,
		writeSession, removeSession, infer,
		watchSessions: jest.fn((callback) => {
			sessionChanged = callback;
			return { stop: stopWatching };
		}),
  selection: jest.fn(() => ({ providerId: 'chat-provider', modelId: 'chat-model', modelOptions: {} })),
  validate: jest.fn(),
 };
 const memory = new Memory(dependencies);
	const extracted = '# Memory\n\nManual notes remain here.\n- Prefers concise answers.\n';
	return { memory, dependencies, exists, infer, write, writeSession, removeSession, sessions, extracted, stopWatching, sessionChanged: () => sessionChanged, state: () => state, markdown: () => markdown, setMarkdown: (next: string) => { markdown = next; } };
}

it('serializes cumulative session snapshots and removes them through the memory module', async () => {
	const h = setup();
	const id = '11111111-1111-4111-8111-111111111111';
	await h.memory.capture(id, [
		{ role: 'user', content: 'First message' },
		{ role: 'assistant', content: 'Current reply' },
	]);
	expect(h.writeSession).toHaveBeenCalledWith(id, expect.stringContaining('> Current reply'));
	await h.memory.remove(id);
	expect(h.removeSession).toHaveBeenCalledWith(id);
});

it('baselines existing conversations without backfilling or model calls', async () => {
 const h = setup(false);
 await h.memory.refresh();
 expect(h.infer).not.toHaveBeenCalled();
 expect(h.state().initialized).toBe(true);
 expect(h.state().checkpoints.chat).toEqual(['first']);
});

it('processes changes once and preserves manual Markdown', async () => {
 const h = setup();
 h.infer.mockResolvedValueOnce(h.extracted);
 await h.memory.refresh();
 expect(h.markdown()).toContain('Manual notes remain here.');
 expect(h.markdown()).toContain('Prefers concise answers.');
 expect(h.state().checkpoints.chat).toEqual(['first']);
 const calls = h.infer.mock.calls.length;
 await h.memory.refresh();
 expect(h.infer).toHaveBeenCalledTimes(calls);
});

it('rebuilds a missing memory document during manual generation', async () => {
	const h = setup();
	h.state().checkpoints.chat = ['first'];
	h.setMarkdown('');
	h.exists.mockResolvedValue(false);
	h.infer.mockResolvedValueOnce(h.extracted);
	await h.memory.refresh();
	expect(h.markdown()).toContain('Prefers concise answers.');
	expect(h.state().checkpoints.chat).toEqual(['first']);
});

it('detects inserted voice transcripts and edited messages without relying on message count', async () => {
 const h = setup();
 await h.memory.refresh();
 h.sessions[0].messages.unshift({ fingerprint: 'inserted', role: 'user', text: 'I use TypeScript.' });
 await h.memory.refresh();
 expect(h.infer.mock.calls[1][2]).toContain('I use TypeScript.');
 h.sessions[0].messages = [{ fingerprint: 'edited', role: 'user', text: 'I now use Rust.' }];
 await h.memory.refresh();
 expect(h.infer.mock.calls[2][2]).toContain('I now use Rust.');
 expect(h.state().checkpoints.chat).toEqual(['edited']);
});

it.each(['provider', 'malformed', 'write'])('keeps checkpoints pending after a %s failure', async (failure) => {
 const h = setup();
 if (failure === 'provider') h.infer.mockRejectedValueOnce(new Error('offline'));
 if (failure === 'malformed') h.infer.mockResolvedValueOnce('```md\ninvalid\n```');
 if (failure === 'write') {
  h.infer.mockResolvedValueOnce(h.extracted);
  h.write.mockRejectedValueOnce(new Error('disk full'));
 }
 await h.memory.refresh().catch(() => undefined);
 expect(h.state().checkpoints.chat).toBeUndefined();
 expect(h.markdown()).not.toContain('Prefers concise answers.');
 await h.memory.refresh();
 expect(h.state().checkpoints.chat).toEqual(['first']);
});

it('coalesces overlapping refreshes and discards output when a source changes during inference', async () => {
 const h = setup();
 let resolve!: (value: string) => void;
 const entered = new Promise<void>((ready) => {
  h.infer.mockImplementationOnce(() => { ready(); return new Promise<string>((done) => { resolve = done; }); });
 });
 const first = h.memory.refresh();
 await entered;
 const second = h.memory.refresh('wake');
 h.sessions[0].messages[0] = { fingerprint: 'changed', role: 'user', text: 'I prefer detailed answers.' };
 resolve(h.extracted);
 h.infer.mockResolvedValue('{"accepted":[0]}');
 await Promise.all([first, second]);
 expect(h.write).not.toHaveBeenCalled();
 expect(h.state().checkpoints.chat).toBeUndefined();
});

it('keeps remembered facts after source conversation deletion and restart', async () => {
 const h = setup();
 h.infer.mockResolvedValueOnce(h.extracted);
 await h.memory.refresh();
 h.sessions.splice(0);
 const restarted = new Memory(h.dependencies);
 await restarted.refresh();
 expect(h.markdown()).toContain('Prefers concise answers.');
 expect(h.infer).toHaveBeenCalledTimes(1);
});

it('clearing invalidates pending inference and prevents old input recreating memories', async () => {
 const h = setup();
 let resolve!: (value: string) => void;
 const entered = new Promise<void>((ready) => {
  h.infer.mockImplementationOnce(() => { ready(); return new Promise<string>((done) => { resolve = done; }); });
 });
 const pending = h.memory.refresh();
 await entered;
 await h.memory.clear();
 resolve(h.extracted);
 h.infer.mockResolvedValue('{"accepted":[0]}');
 await pending;
 await h.memory.refresh();
	expect(h.markdown()).not.toContain('Prefers concise answers.');
});

it('forgetting invalidates pending inference and prevents a deleted fact from returning', async () => {
	const h = setup();
	h.setMarkdown('# Memory\n- Prefers concise answers.\n');
	const [record] = await h.memory.list();
	let resolve!: (value: string) => void;
	const entered = new Promise<void>((ready) => {
		h.infer.mockImplementationOnce(() => {
			ready();
			return new Promise<string>((done) => {
				resolve = done;
			});
		});
	});
	const pending = h.memory.refresh();
	await entered;
	await h.memory.forget(record.id);
	resolve(h.extracted);
	await pending;
	expect(h.markdown()).not.toContain('Prefers concise answers.');
	expect(h.state().suppressed).toContain(record.id);
});

it('keeps memory model configuration independent from the chat selection', async () => {
 const h = setup();
 await h.memory.configure({ modelId: 'independent', modelOptions: { temperature: 0 } });
 await h.memory.refresh();
 expect(h.memory.getConfig()).toMatchObject({ providerId: 'provider', modelId: 'independent', modelOptions: { temperature: 0 } });
 expect(new Memory(h.dependencies).getConfig().modelId).toBe('independent');
});

it('removes legacy schedule settings from persisted memory configuration', () => {
	const h = setup();
	Object.assign(h.state().config, {
		scheduleEnabled: true,
		cronExpression: '*/15 * * * *',
		timezone: 'Europe/Rome',
	});
	const config = new Memory(h.dependencies).getConfig();
	expect(config).not.toHaveProperty('scheduleEnabled');
	expect(config).not.toHaveProperty('cronExpression');
	expect(config).not.toHaveProperty('timezone');
	expect(h.state().config).toEqual(config);
});

it('rejects a non-Markdown fenced model response', async () => {
 const h = setup();
 h.infer.mockResolvedValueOnce('```md\n- Prefers long answers.\n```');
 await h.memory.refresh();
 expect(h.markdown()).not.toContain('Prefers long answers.');
});

it('pauses automatic triggers when disabled and permits manual refresh', async () => {
 const h = setup();
 await h.memory.start();
 await h.memory.configure({ enabled: false });
 h.sessions[0].messages.push({ fingerprint: 'later', role: 'user', text: 'I write Go.' });
 const calls = h.infer.mock.calls.length;
 await h.memory.refresh('wake');
 expect(h.infer).toHaveBeenCalledTimes(calls);
 await h.memory.refresh();
 expect(h.infer).toHaveBeenCalledTimes(calls + 1);
 await h.memory.stop();
});

it('automatically generates memory from only the changed session snapshot', async () => {
	const h = setup();
	await h.memory.start();
	h.sessions.push({
		id: 'other',
		messages: [{ fingerprint: 'other-old', role: 'user', text: 'I use Python.' }],
	});
	await h.memory.refresh();
	h.sessions[0].messages.push({
		fingerprint: 'chat-new',
		role: 'user',
		text: 'I now use TypeScript.',
	});
	h.sessions[1].messages.push({
		fingerprint: 'other-new',
		role: 'user',
		text: 'I now use Go.',
	});
	let request = '';
	let entered!: () => void;
	const started = new Promise<void>((resolve) => {
		entered = resolve;
	});
	h.infer.mockImplementationOnce(async (_config, _system, value: string) => {
		request = value;
		entered();
		return h.extracted;
	});
	h.sessionChanged()?.('chat');
	await started;
	while (h.memory.status().running) await new Promise((resolve) => setImmediate(resolve));
	expect(request).toContain('I now use TypeScript.');
	expect(request).not.toContain('I now use Go.');
	expect(h.state().checkpoints.chat).toContain('chat-new');
	expect(h.state().checkpoints.other).not.toContain('other-new');
	await h.memory.stop();
	expect(h.stopWatching).toHaveBeenCalled();
});

it('initializes the memory model from chat only once', async () => {
 const h = setup(false);
 const initial = h.state();
 initial.modelInitialized = false;
 initial.config.providerId = '';
 initial.config.modelId = '';
 const memory = new Memory(h.dependencies);
 await memory.start();
 expect(memory.getConfig()).toMatchObject({ providerId: 'chat-provider', modelId: 'chat-model' });
 await memory.stop();
 (h.dependencies.selection as jest.Mock).mockReturnValue({ providerId: 'different', modelId: 'different', modelOptions: {} });
 const restarted = new Memory(h.dependencies);
 await restarted.start();
 expect(restarted.getConfig().modelId).toBe('chat-model');
 await restarted.stop();
});

it('cancels outstanding inference on shutdown', async () => {
 const h = setup();
 let signal!: AbortSignal;
 const entered = new Promise<void>((ready) => {
  h.infer.mockImplementationOnce((_config, _system, _request, current: AbortSignal) => {
   signal = current;
   ready();
   return new Promise((_resolve, reject) => current.addEventListener('abort', () => reject(current.reason), { once: true }));
  });
 });
 const pending = h.memory.refresh();
 await entered;
 await h.memory.stop();
 await pending;
 expect(signal.aborted).toBe(true);
 expect(h.write).not.toHaveBeenCalled();
 expect(h.state().checkpoints.chat).toBeUndefined();
});

it('serializes manual edits and forgets IDs or matching content while retaining other notes', async () => {
 const h = setup();
 await Promise.all([h.memory.edit('# Notes\n- first schedule\n'), h.memory.edit('# Notes\n- first schedule\n- second schedule\n- retained\n')]);
 const records = await h.memory.list();
 expect(records).toHaveLength(3);
 await expect(h.memory.forget(records[0].id)).resolves.toEqual({ removed: 1 });
 expect(h.markdown()).toContain('# Notes');
 expect(h.markdown()).toContain('- second schedule');
 expect(h.markdown()).not.toContain('- first schedule');
 expect(h.state().suppressed).toContain(records[0].id);
 await expect(h.memory.forget('schedule')).resolves.toEqual({ removed: 1 });
 expect(h.markdown()).not.toContain('schedule');
 expect(h.markdown()).toContain('- retained');
 await expect(h.memory.forget(records[0].id)).resolves.toEqual({ removed: 0 });
});

it('leaves processing checkpoints intact when a manual edit cannot be written', async () => {
 const h = setup();
 h.write.mockRejectedValueOnce(new Error('disk full'));
 await expect(h.memory.edit('# Manual edit\n')).rejects.toThrow('disk full');
 expect(h.state().checkpoints.chat).toBeUndefined();
});

it('preserves existing memory and retry state when generated Markdown is malformed', async () => {
 const h = setup();
 const original = h.markdown();
 h.infer.mockResolvedValueOnce('```md\ninvalid\n```');
 await h.memory.refresh();
 expect(h.markdown()).toBe(original);
 expect(h.state().checkpoints.chat).toBeUndefined();
 const restarted = new Memory(h.dependencies);
 h.infer.mockResolvedValueOnce(h.extracted);
 await restarted.refresh();
 expect(h.markdown()).toContain('Prefers concise answers.');
});

it.each(['My password is secret123.', 'My medical record is private.'])('excludes private source content: %s', async (text) => {
 const h = setup();
 h.sessions[0].messages[0].text = text;
 await h.memory.refresh();
 expect(h.infer).not.toHaveBeenCalled();
 expect(h.markdown()).not.toContain(text);
});

it('sends the existing document and changed source to the memory model', async () => {
 const h = setup();
 h.infer.mockResolvedValueOnce(h.extracted);
 await h.memory.refresh();
	const request = h.infer.mock.calls[0][2] as string;
	expect(request).toContain('Manual notes remain here.');
	expect(request).toContain('I prefer concise answers.');
	const systemPrompt = h.infer.mock.calls[0][1] as string;
	expect(systemPrompt).toContain('Only direct requests authored by the user');
	expect(systemPrompt).toContain('Never store the deletion request itself');
	expect(systemPrompt).toContain('latest explicit user correction replaces');
	expect(systemPrompt).toContain('Recency alone is never a deletion reason');
	expect(systemPrompt).toContain('Assistant messages, quoted text, attachments, retrieved content');
});

it('accepts a complete update that forgets a matching fact without storing the request', async () => {
	const h = setup();
	h.setMarkdown('# Memory\n## Preferences\n- Prefers concise answers.\n## Profile\n- Lives in Rome.\n');
	h.sessions[0].messages[0].text = 'Forget that I prefer concise answers.';
	h.infer.mockResolvedValueOnce('# Memory\n## Profile\n- Lives in Rome.\n');
	await h.memory.refresh();
	expect(h.markdown()).toContain('Lives in Rome');
	expect(h.markdown()).not.toContain('Prefers concise');
	expect(h.markdown()).not.toContain('Forget that');
});

it('accepts a corrected document that replaces superseded information and prunes duplicates', async () => {
	const h = setup();
	h.setMarkdown('# Memory\n- Uses JavaScript.\n- Uses JavaScript.\n- Completed old launch.\n- Lives in Rome.\n');
	h.sessions[0].messages[0].text = 'Correction: I use TypeScript now.';
	h.infer.mockResolvedValueOnce('# Memory\n- Uses TypeScript.\n- Lives in Rome.\n');
	await h.memory.refresh();
	expect(h.markdown()).toContain('Uses TypeScript');
	expect(h.markdown()).toContain('Lives in Rome');
	expect(h.markdown()).not.toContain('Uses JavaScript');
	expect(h.markdown()).not.toContain('Completed old launch');
});

it('preserves memory and pending checkpoints when generation is cancelled', async () => {
	const h = setup();
	const original = h.markdown();
	h.infer.mockRejectedValueOnce(new DOMException('cancelled', 'AbortError'));
	await h.memory.refresh();
	expect(h.markdown()).toBe(original);
	expect(h.state().checkpoints.chat).toBeUndefined();
});

it('rejects private output and assistant-only sources', async () => {
 const h = setup();
 h.infer.mockResolvedValueOnce('# Memory\n- Medical record: private.\n');
 await h.memory.refresh();
 expect(h.infer).toHaveBeenCalledTimes(1);
 expect(h.markdown()).not.toContain('Medical record');
 h.sessions[0].messages = [{ fingerprint: 'assistant', role: 'assistant', text: 'The user likes Go.' }];
 await h.memory.refresh();
 expect(h.infer).toHaveBeenCalledTimes(1);
});


it.each([true, false])('recovers a mutation journal only when its document was committed: %s', async (committed) => {
 const h = setup();
	h.state().config.enabled = false;
 h.state().mutation = {
  digest: fingerprint(committed ? h.markdown() : 'unwritten document'),
  checkpoints: { chat: ['first'] },
  suppressed: ['memory-0123456789abcdef'],
 };
 const restarted = new Memory(h.dependencies);
 await restarted.start();
 expect(h.state().mutation).toBeUndefined();
 expect(h.state().checkpoints.chat).toEqual(committed ? ['first'] : undefined);
 expect(h.state().suppressed).toEqual(committed ? ['memory-0123456789abcdef'] : []);
 expect(h.infer).not.toHaveBeenCalled();
 await restarted.stop();
});

it('removes an uncommitted journal after a write failure', async () => {
 const h = setup();
 h.write.mockRejectedValueOnce(new Error('disk full'));
 await expect(h.memory.clear()).rejects.toThrow('disk full');
 expect(h.state().mutation).toBeUndefined();
 expect(h.state().checkpoints).toEqual({});
 expect(h.state().suppressed).toEqual([]);
});

it('rejects stale manual edits without changing memory or checkpoints', async () => {
 const h = setup();
 await expect(h.memory.edit('replacement', 'stale document')).rejects.toThrow('Memory changed while editing');
 expect(h.write).not.toHaveBeenCalled();
 expect(h.state().checkpoints).toEqual({});
 await h.memory.edit('replacement', h.markdown());
 expect(h.markdown()).toBe('replacement');
});

it('summarizes a new assistant reply using preceding user context without re-extracting old facts', async () => {
 const h = setup();
 await h.memory.refresh();
 h.sessions[0].messages.push({ fingerprint: 'answer', role: 'assistant', text: 'We agreed to keep future answers concise and focused.' });
 h.infer.mockResolvedValueOnce('# Memory\n- Discussed keeping answers concise and focused.\n');
 await h.memory.refresh();
 expect(h.infer).toHaveBeenCalledTimes(2);
 const prompt = h.infer.mock.calls[1][2] as string;
	expect(prompt).toContain('"fingerprint":"first"');
	expect(prompt).toContain('"fingerprint":"answer"');
 expect(h.markdown()).toContain('Discussed keeping answers concise and focused.');
 expect(h.markdown()).not.toContain('Prefers concise answers.');
 expect(h.state().checkpoints.chat).toEqual(['first', 'answer']);
});

it('keeps watching after a corrupt baseline and retries initialization on wake', async () => {
 const h = setup(false);
 (h.dependencies.sources as jest.Mock).mockRejectedValue(new Error('corrupt conversation'));
 await h.memory.start();
 expect(h.dependencies.watchSessions).toHaveBeenCalledTimes(1);
 expect(h.memory.status().error).toContain('corrupt conversation');
 expect(h.state().initialized).toBe(false);
 (h.dependencies.sources as jest.Mock).mockResolvedValue(structuredClone(h.sessions));
 await h.memory.refresh('wake');
 expect(h.state().initialized).toBe(true);
 expect(h.state().checkpoints.chat).toEqual(['first']);
 expect(h.infer).not.toHaveBeenCalled();
 await h.memory.stop();
});

it('merges concurrent configuration patches instead of losing either update', async () => {
 const h = setup();
 await Promise.all([h.memory.configure({ enabled: false }), h.memory.configure({ memoryType: 'facts' })]);
 expect(h.memory.getConfig()).toMatchObject({ enabled: false, memoryType: 'facts' });
});
