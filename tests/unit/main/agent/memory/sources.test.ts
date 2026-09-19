import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { scanSources } from '../../../../../src/main/memory/sources';

it('scans desktop chat and voice with stable fingerprints, bounded text, and edit detection', async () => {
 const root = await fs.mkdtemp(path.join(os.tmpdir(), 'kucedr-memory-sources-'));
 const location = path.join(root, 'workspace');
 const ids = ['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', '33333333-3333-4333-8333-333333333333'];
 try {
  for (const [index, type] of ['main', 'voice', 'task'].entries()) {
   const folder = path.join(root, 'sessions', ids[index]);
   await fs.mkdir(folder, { recursive: true });
   await fs.writeFile(path.join(folder, 'info.json'), JSON.stringify({ type }));
   await fs.writeFile(path.join(folder, 'messages.json'), JSON.stringify([{ role: 'user', content: index === 0 ? 'x'.repeat(9000) : 'original transcript' }]));
  }
  const first = await scanSources(location);
  expect(first.map((source) => source.id)).toEqual(ids.slice(0, 2));
  expect(first[0].messages.map((message) => message.text.length)).toEqual([4000, 4000, 1000]);
  expect(await scanSources(location)).toEqual(first);
  const voice = path.join(root, 'sessions', ids[1], 'messages.json');
  await fs.writeFile(voice, JSON.stringify([{ role: 'user', content: 'inserted transcript' }, { role: 'user', content: 'original transcript' }]));
  const inserted = await scanSources(location);
  expect(inserted[1].messages[1].fingerprint).toBe(first[1].messages[0].fingerprint);
  await fs.writeFile(voice, JSON.stringify([{ role: 'user', content: 'edited transcript' }]));
  expect((await scanSources(location))[1].messages[0].fingerprint).not.toBe(first[1].messages[0].fingerprint);
  await fs.writeFile(voice, '{invalid');
  await expect(scanSources(location)).rejects.toThrow('memory processing will retry');
 } finally {
  await fs.rm(root, { recursive: true, force: true });
 }
});
