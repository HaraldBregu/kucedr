import { fingerprint } from '../../../../../src/main/memory/fingerprint';
import { Memory } from '../../../../../src/main/memory/service';
import type { MemoryDependencies, MemoryState, SourceSession } from '../../../../../src/main/memory/types';

function setup(initialized = true) {
 let state: MemoryState = {
  config: { enabled: true, providerId: 'provider', modelId: 'model', modelOptions: {}, memoryType: 'both', scheduleEnabled: true, cronExpression: '*/15 * * * *', timezone: 'Europe/Rome' },
  initialized, modelInitialized: true, checkpoints: {}, suppressed: [], lastSuccess: null,
 };
 let markdown = '# Memory\n\nManual notes remain here.\n';
 const sessions: SourceSession[] = [{ id: 'chat', messages: [{ fingerprint: 'first', role: 'user', text: 'I prefer concise answers.' }] }];
	const infer = jest.fn(async () => markdown);
 const write = jest.fn(async (next: string) => { markdown = next; });
	const writeSession = jest.fn(async () => undefined);
	const removeSession = jest.fn(async () => undefined);
	const exists = jest.fn(async () => true);
 const stop = jest.fn();
 const dependencies: MemoryDependencies = {
  store: { load: () => structuredClone(state), save: (next) => { state = structuredClone(next); } },
		sources: jest.fn(async () => structuredClone(sessions)), exists, read: async () => markdown, write,
		writeSession, removeSession, infer,
  selection: jest.fn(() => ({ providerId: 'chat-provider', modelId: 'chat-model', modelOptions: {} })),
  schedule: jest.fn(() => ({ stop })), validate: jest.fn(),
 };
 const memory = new Memory(dependencies);
	const extracted = '# Memory\n\nManual notes remain here.\n- Prefers concise answers.\n';
	return { memory, dependencies, exists, infer, write, writeSession, removeSession, sessions, extracted, stop, state: () => state, markdown: () => markdown, setMarkdown: (next: string) => { markdown = next; } };
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

it('keeps memory model configuration independent from the chat selection', async () => {
 const h = setup();
 await h.memory.configure({ modelId: 'independent', modelOptions: { temperature: 0 } });
 await h.memory.refresh();
 expect(h.memory.getConfig()).toMatchObject({ providerId: 'provider', modelId: 'independent', modelOptions: { temperature: 0 } });
 expect(new Memory(h.dependencies).getConfig().modelId).toBe('independent');
});

it('rejects a non-Markdown fenced model response', async () => {
 const h = setup();
 h.infer.mockResolvedValueOnce('```md\n- Prefers long answers.\n```');
 await h.memory.refresh();
 expect(h.markdown()).not.toContain('Prefers long answers.');
});

it('reschedules cron, pauses automatic triggers, and permits manual refresh', async () => {
 const h = setup();
 await h.memory.start();
 expect(h.dependencies.schedule).toHaveBeenCalledWith('*/15 * * * *', 'Europe/Rome', expect.any(Function));
 await h.memory.configure({ cronExpression: '0 * * * *', timezone: 'UTC' });
 expect(h.stop).toHaveBeenCalled();
 expect(h.dependencies.schedule).toHaveBeenLastCalledWith('0 * * * *', 'UTC', expect.any(Function));
 await h.memory.configure({ enabled: false });
 h.sessions[0].messages.push({ fingerprint: 'later', role: 'user', text: 'I write Go.' });
 const calls = h.infer.mock.calls.length;
 await h.memory.refresh('wake');
 expect(h.infer).toHaveBeenCalledTimes(calls);
 await h.memory.refresh();
 expect(h.infer).toHaveBeenCalledTimes(calls + 1);
 await h.memory.stop();
});

it('rejects invalid configuration without replacing the working schedule', async () => {
 const h = setup();
 await h.memory.start();
 (h.dependencies.validate as jest.Mock).mockImplementationOnce(() => { throw new Error('Invalid cron expression.'); });
 await expect(h.memory.configure({ cronExpression: 'not cron' })).rejects.toThrow('Invalid cron');
 expect(h.memory.getConfig().cronExpression).toBe('*/15 * * * *');
 expect(h.stop).not.toHaveBeenCalled();
 await h.memory.stop();
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

it('serializes manual edits and forgets exact IDs while retaining other notes', async () => {
 const h = setup();
 await Promise.all([h.memory.edit('# Notes\n- first\n'), h.memory.edit('# Notes\n- first\n- second\n')]);
 const records = await h.memory.list();
 expect(records).toHaveLength(2);
 await expect(h.memory.forget(records[0].id)).resolves.toEqual({ removed: true });
 expect(h.markdown()).toContain('# Notes');
 expect(h.markdown()).toContain('- second');
 expect(h.markdown()).not.toContain('- first');
 expect(h.state().suppressed).toContain(records[0].id);
 await expect(h.memory.forget(records[0].id)).resolves.toEqual({ removed: false });
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
 h.state().config.scheduleEnabled = false;
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

it('uses manual refresh only when the schedule is disabled', async () => {
 const h = setup();
 await h.memory.configure({ scheduleEnabled: false });
 await h.memory.start();
 await h.memory.refresh('wake');
 await h.memory.refresh('cron');
 expect(h.dependencies.schedule).not.toHaveBeenCalled();
 expect(h.infer).not.toHaveBeenCalled();
 await h.memory.refresh();
 expect(h.infer).toHaveBeenCalledTimes(1);
 await h.memory.stop();
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

it('keeps scheduling after a corrupt baseline and retries initialization', async () => {
 const h = setup(false);
 (h.dependencies.sources as jest.Mock).mockRejectedValue(new Error('corrupt conversation'));
 await h.memory.start();
 expect(h.dependencies.schedule).toHaveBeenCalledTimes(1);
 expect(h.memory.status().error).toContain('corrupt conversation');
 expect(h.state().initialized).toBe(false);
 (h.dependencies.sources as jest.Mock).mockResolvedValue(structuredClone(h.sessions));
 const scheduled = (h.dependencies.schedule as jest.Mock).mock.calls[0][2];
 await scheduled();
 expect(h.state().initialized).toBe(true);
 expect(h.state().checkpoints.chat).toEqual(['first']);
 expect(h.infer).not.toHaveBeenCalled();
 await h.memory.stop();
});

it('merges concurrent configuration patches instead of losing either update', async () => {
 const h = setup();
 await Promise.all([h.memory.configure({ timezone: 'UTC' }), h.memory.configure({ memoryType: 'facts' })]);
 expect(h.memory.getConfig()).toMatchObject({ timezone: 'UTC', memoryType: 'facts' });
});
