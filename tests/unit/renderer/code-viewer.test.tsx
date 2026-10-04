import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CodeFileViewer } from '../../../src/renderer/src/pages/code/Viewer';

jest.mock('react-i18next', () => {
	const t = (key: string, fallback?: string): string => fallback ?? key;
	return { useTranslation: () => ({ t }) };
});
jest.mock('@/hooks/use-is-dark', () => ({ useIsDark: () => false }));
jest.mock('@/pages/workspace/Editor', () => ({
	CodeMirrorEditor: ({ value, onChange, readOnly, onSave }: { value: string; onChange: (value: string) => void; readOnly: boolean; onSave: () => void }) => (
		<textarea aria-label="Markdown" value={value} readOnly={readOnly} onKeyDown={(event) => { if (event.key === 's' && event.metaKey) onSave(); }} onChange={(event) => onChange(event.target.value)} />
	),
}));

const readMarkdownFile = jest.fn();
const saveMarkdownFile = jest.fn();

beforeEach(() => {
	jest.clearAllMocks();
	readMarkdownFile.mockResolvedValue('# Original');
	saveMarkdownFile.mockResolvedValue(undefined);
	Object.defineProperty(window, 'coder', { configurable: true, value: { readMarkdownFile, saveMarkdownFile } });
});

it('loads Markdown and saves edits against the original disk content', async () => {
	render(<CodeFileViewer projectId="save" fileName="notes.md" />);
	expect(await screen.findByLabelText('Markdown')).toHaveValue('# Original');
	expect(readMarkdownFile).toHaveBeenCalledWith('save', 'notes.md');
	fireEvent.change(screen.getByLabelText('Markdown'), { target: { value: '# Edited' } });
	fireEvent.keyDown(screen.getByLabelText('Markdown'), { key: 's', metaKey: true });
	await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Saved'));
	expect(saveMarkdownFile).toHaveBeenCalledWith('save', 'notes.md', '# Edited', '# Original');
});

it('preserves unsaved drafts when switching files and back', async () => {
	const view = render(<CodeFileViewer key="first" projectId="draft" fileName="notes.md" />);
	fireEvent.change(await screen.findByLabelText('Markdown'), { target: { value: '# Keep me' } });
	view.rerender(<CodeFileViewer key="second" projectId="draft" fileName="AGENTS.md" />);
	expect(await screen.findByLabelText('Markdown')).toHaveValue('# Original');
	view.rerender(<CodeFileViewer key="first" projectId="draft" fileName="notes.md" />);
	expect(await screen.findByLabelText('Markdown')).toHaveValue('# Keep me');
	expect(screen.getByRole('status')).toHaveTextContent('Unsaved changes');
	expect(saveMarkdownFile).not.toHaveBeenCalled();
});

it('keeps edits on a save conflict and reloads only when explicitly requested', async () => {
	saveMarkdownFile.mockRejectedValueOnce(new Error('File changed on disk'));
	render(<CodeFileViewer projectId="conflict" fileName="AGENTS.md" />);
	fireEvent.change(await screen.findByLabelText('Markdown'), { target: { value: '# My instructions' } });
	fireEvent.keyDown(screen.getByLabelText('Markdown'), { key: 's', metaKey: true });
	expect(await screen.findByRole('alert')).toHaveTextContent('File changed on disk');
	expect(screen.getByLabelText('Markdown')).toHaveValue('# My instructions');
	readMarkdownFile.mockResolvedValue('# External instructions');
	fireEvent.click(screen.getByRole('button', { name: 'Discard edits and reload' }));
	expect(await screen.findByLabelText('Markdown')).toHaveValue('# External instructions');
	expect(screen.queryByRole('button', { name: 'Save', exact: true })).not.toBeInTheDocument();
});

it('shows read errors and allows a reload', async () => {
	readMarkdownFile.mockRejectedValueOnce(new Error('Unable to read'));
	render(<CodeFileViewer projectId="read-error" fileName="notes.md" />);
	expect(await screen.findByRole('alert')).toHaveTextContent('Unable to read');
	expect(screen.queryByRole('button', { name: 'Save', exact: true })).not.toBeInTheDocument();
	fireEvent.click(screen.getByRole('button', { name: 'Reload' }));
	expect(await screen.findByLabelText('Markdown')).toHaveValue('# Original');
});

it('ignores stale reads after selecting another file', async () => {
	let finishRead!: (content: string) => void;
	readMarkdownFile.mockImplementationOnce(() => new Promise<string>((resolve) => { finishRead = resolve; }));
	const view = render(<CodeFileViewer key="old" projectId="stale" fileName="old.md" />);
	await waitFor(() => expect(readMarkdownFile).toHaveBeenCalledWith('stale', 'old.md'));
	view.rerender(<CodeFileViewer key="new" projectId="stale" fileName="new.md" />);
	expect(await screen.findByLabelText('Markdown')).toHaveValue('# Original');
	await act(async () => { finishRead('# Stale'); });
	expect(screen.getByLabelText('Markdown')).toHaveValue('# Original');
});

it('finishes a pending save while another file is open and restores the saved draft', async () => {
	let finishSave!: () => void;
	saveMarkdownFile.mockImplementationOnce(() => new Promise<void>((resolve) => { finishSave = resolve; }));
	const view = render(<CodeFileViewer key="pending" projectId="pending" fileName="notes.md" />);
	fireEvent.change(await screen.findByLabelText('Markdown'), { target: { value: '# Pending' } });
	fireEvent.keyDown(screen.getByLabelText('Markdown'), { key: 's', metaKey: true });
	view.rerender(<CodeFileViewer key="other" projectId="pending" fileName="other.md" />);
	expect(await screen.findByLabelText('Markdown')).toHaveValue('# Original');
	view.rerender(<CodeFileViewer key="pending" projectId="pending" fileName="notes.md" />);
	await act(async () => { finishSave(); });
	expect(await screen.findByLabelText('Markdown')).toHaveValue('# Pending');
	expect(screen.getByRole('status')).toHaveTextContent('Saved');
});
