import { normalizeAgentInputFiles } from '../../../../src/shared/agent_files';

describe('normalizeAgentInputFiles', () => {
	it('accepts base64 attachments', () => {
		expect(
			normalizeAgentInputFiles([
				{ name: 'note.txt', mimeType: ' text/plain ', data: Buffer.from('hello').toString('base64') },
			])
		).toEqual([
			{ name: 'note.txt', mimeType: 'text/plain', data: Buffer.from('hello').toString('base64') },
		]);
	});

	it('accepts more than ten attachments', () => {
		const file = { name: 'note.txt', mimeType: 'text/plain', data: 'YQ==' };
		expect(normalizeAgentInputFiles(Array.from({ length: 11 }, () => file))).toHaveLength(11);
	});

	it('accepts an empty file', () => {
		expect(normalizeAgentInputFiles([{ name: 'empty.txt', mimeType: 'text/plain', data: '' }])).toEqual([
			{ name: 'empty.txt', mimeType: 'text/plain', data: '' },
		]);
	});

	it('rejects invalid base64', () => {
		expect(() =>
			normalizeAgentInputFiles([{ name: 'bad', mimeType: 'text/plain', data: '!!!!' }])
		).toThrow('base64');
	});

	it('rejects malformed attachment entries instead of silently dropping them', () => {
		expect(() => normalizeAgentInputFiles('file')).toThrow('array');
		expect(() => normalizeAgentInputFiles([{}])).toThrow('name, MIME type, and base64 data');
		expect(() =>
			normalizeAgentInputFiles([{ name: '', mimeType: 'text/plain', data: 'YQ==' }])
		).toThrow('name, MIME type, and base64 data');
	});

	it('accepts files above the former byte limit', () => {
		const data = Buffer.alloc(20 * 1024 * 1024 + 1).toString('base64');
		expect(
			normalizeAgentInputFiles([{ name: 'large', mimeType: 'application/octet-stream', data }])
		).toHaveLength(1);
	});
});
