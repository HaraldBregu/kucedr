import { selectRecords } from '../../../../../src/main/memory/records';
import type { StoredEntry } from '../../../../../src/main/memory/types';

it('excludes private manual notes and oversized records from model context', () => {
 const records: StoredEntry[] = [
  { id: 'private', fact: 'Medical record: private information.', lineIndex: 0 },
  { id: 'secret', fact: 'api_key=abcdefghijklmnopqrstuvwxyz123456', lineIndex: 1 },
  { id: 'oversized', fact: 'x'.repeat(1001), lineIndex: 2 },
  { id: 'safe', fact: 'Prefers TypeScript.', lineIndex: 3 },
 ];
 expect(selectRecords(records, [{ fingerprint: 'new', role: 'user', text: 'TypeScript' }])).toEqual([records[3]]);
});

it('prioritizes relevant older memory while bounding model context by length and count', () => {
 const records: StoredEntry[] = [{ id: 'relevant', fact: 'Prefers TypeScript.', lineIndex: 0 }];
 for (let index = 1; index <= 200; index += 1) records.push({ id: String(index), fact: `Unrelated entry ${index} ${'z'.repeat(180)}`, lineIndex: index });
 const selected = selectRecords(records, [{ fingerprint: 'new', role: 'user', text: 'TypeScript' }]);
 expect(selected[0].id).toBe('relevant');
 expect(selected.length).toBeLessThanOrEqual(80);
 expect(selected.reduce((length, record) => length + record.fact.length, 0)).toBeLessThanOrEqual(10000);
});
