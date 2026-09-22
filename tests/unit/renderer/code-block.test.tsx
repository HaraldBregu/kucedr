import { act, render, screen } from '@testing-library/react';

const codeToHtml = jest.fn();

jest.mock('shiki', () => ({ codeToHtml }));
jest.mock('../../../src/renderer/src/hooks/use-is-dark', () => ({ useIsDark: () => false }));

import { CodeBlockCode } from '../../../src/renderer/src/components/ui/code-block';

it('ignores stale highlighting and keeps current code when highlighting fails', async () => {
	let resolveOld: (html: string) => void = () => undefined;
	codeToHtml
		.mockImplementationOnce(
			() => new Promise<string>((resolve) => {
				resolveOld = resolve;
			})
		)
		.mockResolvedValueOnce('<pre><code>new highlighted</code></pre>')
		.mockRejectedValueOnce(new Error('Unsupported language'));

	const view = render(<CodeBlockCode code="old" />);
	view.rerender(<CodeBlockCode code="new" />);
	await screen.findByText('new highlighted');
	await act(async () => resolveOld('<pre><code>stale highlighted</code></pre>'));
	expect(screen.queryByText('stale highlighted')).toBeNull();

	view.rerender(<CodeBlockCode code="plain current" language="unsupported" />);
	await act(async () => undefined);
	expect(screen.getByText('plain current')).toBeVisible();
});
