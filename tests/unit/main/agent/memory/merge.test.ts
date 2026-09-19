import { mergeMemories } from '../../../../../src/main/memory/merge';
import { parseMemories } from '../../../../../src/main/memory/parse';
import { recall } from '../../../../../src/main/memory/recall';
import type { Extraction } from '../../../../../src/main/memory/types';

const fact: Extraction = { kind: 'fact', topic: 'Programming', text: 'Prefers TypeScript.', evidence: [], replaces: [] };

it('deduplicates normalized text while preserving original Markdown', () => {
 const markdown = '# Manual notes\n\n- prefers typescript\n';
 expect(mergeMemories(markdown, [fact], [])).toBe(markdown);
});

it('replaces corrected facts without removing unrelated notes', () => {
 const markdown = mergeMemories('# Notes\nKeep this paragraph.\n', [fact], []);
 const [previous] = parseMemories(markdown);
 const corrected = mergeMemories(markdown, [{ ...fact, text: 'Prefers Rust.', replaces: [previous.id] }], []);
 expect(corrected).toContain('Keep this paragraph.');
 expect(corrected).toContain('Prefers Rust.');
 expect(corrected).not.toContain('Prefers TypeScript.');
});

it('consolidates summaries while preserving durable facts', () => {
 const markdown = mergeMemories('', [fact, { ...fact, kind: 'summary', text: 'Building a desktop app.' }], []);
 const [durable, summary] = parseMemories(markdown);
 const merged = mergeMemories(markdown, [{ ...fact, kind: 'summary', text: 'Building and testing a desktop app.', replaces: [durable.id, summary.id] }], []);
 expect(merged).toContain('Prefers TypeScript.');
 expect(merged).toContain('Building and testing a desktop app.');
 expect(merged).not.toContain('Building a desktop app.');
});

it('suppresses explicitly forgotten entries', () => {
 const [entry] = parseMemories(mergeMemories('', [fact], []));
 expect(mergeMemories('# Notes\n', [fact], [entry.id])).toBe('# Notes\n');
});

it('recalls relevant context within its bound and omits credentials', () => {
 const markdown = '# Notes\n- Prefers TypeScript.\n- Loves cycling.\n- TypeScript api_key=abcdefghijklmnopqrstuvwxyz123456\n' + '- TypeScript details '.repeat(500);
 const context = recall(markdown, 'TypeScript');
 expect(context).toContain('Prefers TypeScript.');
 expect(context).not.toContain('Loves cycling.');
 expect(context).not.toContain('api_key');
 expect(context.length).toBeLessThanOrEqual(4000);
});
