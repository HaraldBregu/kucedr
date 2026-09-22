import {
	AGENT_MAX_ATTACHMENT_BYTES,
	AGENT_MAX_ATTACHMENT_COUNT,
	normalizeAgentInputFiles,
} from '../../../../src/shared/agent_files';

describe('normalizeAgentInputFiles', () => {
	it('accepts bounded base64 attachments', () => {
		expect(
			normalizeAgentInputFiles([
				{ name: 'note.txt', mimeType: ' text/plain ', data: Buffer.from('hello').toString('base64') },
			])
		).toEqual([
			{ name: 'note.txt', mimeType: 'text/plain', data: Buffer.from('hello').toString('base64') },
		]);
	});

	it('rejects too many attachments', () => {
		const file = { name: 'note.txt', mimeType: 'text/plain', data: 'YQ==' };
		expect(() =>
			normalizeAgentInputFiles(Array.from({ length: AGENT_MAX_ATTACHMENT_COUNT + 1 }, () => file))
		).toThrow('maximum');
	});

	it('rejects invalid base64 and decoded content over the byte limit', () => {
		expect(() =>
			normalizeAgentInputFiles([{ name: 'bad', mimeType: 'text/plain', data: '!!!!' }])
		).toThrow('base64');
		const oversized = Buffer.alloc(AGENT_MAX_ATTACHMENT_BYTES + 1).toString('base64');
		expect(() =>
			normalizeAgentInputFiles([{ name: 'large', mimeType: 'application/octet-stream', data: oversized }])
		).toThrow('at most');
	});

	it('rejects malformed attachment entries instead of silently dropping them', () => {
		expect(() => normalizeAgentInputFiles('file')).toThrow('array');
		expect(() => normalizeAgentInputFiles([{}])).toThrow('name, MIME type, and base64 data');
		expect(() =>
			normalizeAgentInputFiles([{ name: '', mimeType: 'text/plain', data: 'YQ==' }])
		).toThrow('name, MIME type, and base64 data');
	});

	it('uses decoded bytes rather than encoded character count', () => {
		const data = Buffer.alloc(AGENT_MAX_ATTACHMENT_BYTES).toString('base64');
		expect(
			normalizeAgentInputFiles([{ name: 'limit', mimeType: 'application/octet-stream', data }])
		).toHaveLength(1);
	});
});
