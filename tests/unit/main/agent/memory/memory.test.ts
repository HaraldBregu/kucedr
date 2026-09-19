import { Memory } from '../../../../../src/main/memory/service';
import type { MemoryDependencies, MemoryState, SourceSession } from '../../../../../src/main/memory/types';

function setup(initialized = true) {
 let state: MemoryState = {
  config: { enabled: true, providerId: 'provider', modelId: 'model', modelOptions: {}, memoryType: 'both', scheduleEnabled: true, cronExpression: '*/15 * * * *', timezone: 'Europe/Rome' },
  initialized, modelInitialized: true, checkpoints: {}, suppressed: [], lastSuccess: null,
 };
 let markdown = '# Memory\n\nManual notes remain here.\n';
 const sessions: SourceSession[] = [{ id: 'chat', messages: [{ fingerprint: 'first', role: 'user', text: 'I prefer concise answers.' }] }];
 const infer = jest.fn().mockResolvedValue('{"entries":[]}');
 const write = jest.fn(async (next: string) => { markdown = next; });
 const stop = jest.fn();
 const dependencies: MemoryDependencies = {
  store: { load: () => structuredClone(state), save: (next) => { state = structuredClone(next); } },
  sources: jest.fn(async () => structuredClone(sessions)), read: async () => markdown, write, infer,
  selection: jest.fn(() => ({ providerId: 'chat-provider', modelId: 'chat-model', modelOptions: {} })),
  schedule: jest.fn(() => ({ stop })), validate: jest.fn(),
 };
 const memory = new Memory(dependencies);
 const extracted = JSON.stringify({ entries: [{ kind: 'fact', topic: 'Preferences', text: 'Prefers concise answers.', evidence: [{ source: 'first', quote: 'I prefer concise answers.' }] }] });
 return { memory, dependencies, infer, write, sessions, extracted, stop, state: () => state, markdown: () => markdown };
}

it('baselines existing conversations without backfilling or model calls', async () => {
 const h = setup(false);
 await h.memory.refresh();
 expect(h.infer).not.toHaveBeenCalled();
 expect(h.state().initialized).toBe(true);
 expect(h.state().checkpoints.chat).toEqual(['first']);
});

it('processes changes once and preserves manual Markdown', async () => {
 const h = setup();
 h.infer.mockResolvedValueOnce(h.extracted).mockResolvedValueOnce('{"accepted":[0]}');
 await h.memory.refresh();
 expect(h.markdown()).toContain('Manual notes remain here.');
 expect(h.markdown()).toContain('Prefers concise answers.');
 expect(h.state().checkpoints.chat).toEqual(['first']);
 const calls = h.infer.mock.calls.length;
 await h.memory.refresh();
 expect(h.infer).toHaveBeenCalledTimes(calls);
});

it('detects inserted voice transcripts and edited messages without relying on message count', async () => {
 const h = setup();
 await h.memory.refresh();
 h.sessions[0].messages.unshift({ fingerprint: 'inserted', role: 'user', text: 'I use TypeScript.' });
 await h.memory.refresh();
 expect(h.infer.mock.calls[1][1]).toContain('I use TypeScript.');
 h.sessions[0].messages = [{ fingerprint: 'edited', role: 'user', text: 'I now use Rust.' }];
 await h.memory.refresh();
 expect(h.infer.mock.calls[2][1]).toContain('I now use Rust.');
 expect(h.state().checkpoints.chat).toEqual(['edited']);
});

it.each(['provider', 'malformed', 'write'])('keeps checkpoints pending after a %s failure', async (failure) => {
 const h = setup();
 if (failure === 'provider') h.infer.mockRejectedValueOnce(new Error('offline'));
 if (failure === 'malformed') h.infer.mockResolvedValueOnce('invalid JSON');
 if (failure === 'write') {
  h.infer.mockResolvedValueOnce(h.extracted).mockResolvedValueOnce('{"accepted":[0]}');
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
 h.infer.mockResolvedValueOnce(h.extracted).mockResolvedValueOnce('{"accepted":[0]}');
 await h.memory.refresh();
 h.sessions.splice(0);
 const restarted = new Memory(h.dependencies);
 await restarted.refresh();
 expect(h.markdown()).toContain('Prefers concise answers.');
 expect(h.infer).toHaveBeenCalledTimes(2);
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

it('rejects unvalidated quotes and assistant-only evidence', async () => {
 const h = setup();
 h.infer.mockResolvedValueOnce(JSON.stringify({ entries: [{ kind: 'fact', topic: 'Preferences', text: 'Prefers long answers.', evidence: [{ source: 'first', quote: 'I prefer long answers.' }] }] }));
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
  h.infer.mockImplementationOnce((_config, _prompt, current: AbortSignal) => {
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
