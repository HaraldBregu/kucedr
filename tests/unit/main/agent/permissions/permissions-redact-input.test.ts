import { redactApprovalInput } from '../../../../../src/main/agent/permissions/redact_approval_input';

it('redacts nested credential fields without changing ordinary approval scope', () => {
	expect(
		redactApprovalInput({
			url: 'https://example.com',
			token: 'secret',
			auth: { client_secret: 'secret', account: 'visible' },
			items: [{ apiKey: 'secret', name: 'visible' }],
		})
	).toEqual({
		url: 'https://example.com',
		token: '[redacted, 6 chars]',
		auth: { client_secret: '[redacted, 6 chars]', account: 'visible' },
		items: [{ apiKey: '[redacted, 6 chars]', name: 'visible' }],
	});
});

it('keeps bash environment values visible while showing redacted value lengths elsewhere', () => {
	expect(
		redactApprovalInput(
			{ env: { API_KEY: 'visible' }, token: 'secret' },
			'bash'
		)
	).toEqual({ env: { API_KEY: 'visible' }, token: '[redacted, 6 chars]' });
});
