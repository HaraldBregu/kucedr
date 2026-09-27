import { StrictMode } from 'react';
import { render, screen } from '@testing-library/react';
import { WorkspaceMarkdownEditor } from '../../../src/renderer/src/pages/workspace/MarkdownEditor';

it('opens existing Markdown through the StrictMode editor lifecycle', async () => {
	render(
		<StrictMode>
			<WorkspaceMarkdownEditor value="# Existing note" onChange={jest.fn()} onSave={jest.fn()} />
		</StrictMode>
	);
	expect(await screen.findByRole('textbox', { name: 'Markdown preview editor' })).toHaveTextContent('Existing note');
});
