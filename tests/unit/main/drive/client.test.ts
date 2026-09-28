jest.mock('../../../../src/main/mcp', () => ({
	getMcpOauth: jest.fn(),
	saveMcpOauth: jest.fn(),
}));

import { getMcpOauth, saveMcpOauth } from '../../../../src/main/mcp';
import { DriveClient } from '../../../../src/main/drive/client';

const originalFetch = global.fetch;
const originalClientId = process.env.GOOGLE_CLIENT_ID;
const originalSecret = process.env.GOOGLE_CLIENT_SECRET;

beforeEach(() => {
	process.env.GOOGLE_CLIENT_ID = 'client-id';
	process.env.GOOGLE_CLIENT_SECRET = 'client-secret';
	jest.mocked(getMcpOauth).mockReturnValue({
		tokensClientId: 'client-id',
		tokens: { access_token: 'old-token', refresh_token: 'refresh-token', token_type: 'Bearer' },
	});
	global.fetch = jest.fn();
});

afterEach(() => {
	global.fetch = originalFetch;
	if (originalClientId === undefined) delete process.env.GOOGLE_CLIENT_ID;
	else process.env.GOOGLE_CLIENT_ID = originalClientId;
	if (originalSecret === undefined) delete process.env.GOOGLE_CLIENT_SECRET;
	else process.env.GOOGLE_CLIENT_SECRET = originalSecret;
	jest.clearAllMocks();
});

it('refreshes an expired token and retains its refresh credential', async () => {
	jest.mocked(global.fetch)
		.mockResolvedValueOnce(new Response('', { status: 401 }))
		.mockResolvedValueOnce(new Response(JSON.stringify({ access_token: 'new-token', expires_in: 3600 }), { status: 200 }))
		.mockResolvedValueOnce(new Response(JSON.stringify({ files: [{ id: 'file-1', name: 'Notes', mimeType: 'text/plain' }] }), { status: 200 }));
	const files = await new DriveClient().list('Notes');
	expect(files.map((file) => file.id)).toEqual(['file-1']);
	expect(jest.mocked(global.fetch).mock.calls[2][1]?.headers).toMatchObject({ Authorization: 'Bearer new-token' });
	expect(saveMcpOauth).toHaveBeenCalledWith('google-drive', expect.objectContaining({
		tokens: expect.objectContaining({ access_token: 'new-token', refresh_token: 'refresh-token' }),
	}));
});

it('rejects a token belonging to a different OAuth client before sending a request', async () => {
	jest.mocked(getMcpOauth).mockReturnValue({ tokensClientId: 'other-client', tokens: { access_token: 'old-token', token_type: 'Bearer' } });
	await expect(new DriveClient().list()).rejects.toThrow('credentials changed');
	expect(global.fetch).not.toHaveBeenCalled();
});

it('does not decode a binary recording as text', async () => {
	jest.mocked(global.fetch).mockResolvedValueOnce(new Response(JSON.stringify({ id: 'recording', name: 'Meeting.mp4', mimeType: 'video/mp4' }), { status: 200 }));
	await expect(new DriveClient().read('recording')).rejects.toThrow('binary content');
	expect(global.fetch).toHaveBeenCalledTimes(1);
});
