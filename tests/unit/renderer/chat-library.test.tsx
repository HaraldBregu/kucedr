import { fireEvent, render, screen } from '@testing-library/react';
import { ChatLibrary } from '../../../src/renderer/src/pages/home/Library';
import { droppedLibraryFiles } from '../../../src/renderer/src/pages/home/attachments/library';
import { LIBRARY_DRAG_TYPE } from '../../../src/renderer/src/pages/settings/pages/library/drag';

const file = { name: 'notes.md', path: '/library/notes.md', relativePath: 'notes.md', size: 12, modifiedAt: '2026-10-28T00:00:00Z' };

beforeEach(() => {
	Object.defineProperty(window, 'library', { configurable: true, value: { list: jest.fn().mockResolvedValue([file, { ...file, kind: 'folder', relativePath: 'folder' }]) } });
});

it('lists files with click-to-attach and copy drag payloads, excluding folders', async () => {
	const onAttach = jest.fn();
	render(<ChatLibrary refreshKey="chat" onAttach={onAttach} />);
	const button = await screen.findByRole('button', { name: 'Attach notes.md' });
	expect(screen.queryByRole('button', { name: 'Attach folder' })).not.toBeInTheDocument();
	fireEvent.click(button);
	expect(onAttach).toHaveBeenCalledWith([file]);
	const dataTransfer = { setData: jest.fn(), effectAllowed: '' };
	fireEvent.dragStart(button, { dataTransfer });
	expect(dataTransfer.setData).toHaveBeenCalledWith(LIBRARY_DRAG_TYPE, '["notes.md"]');
	expect(dataTransfer.effectAllowed).toBe('copy');
});

it('resolves dropped paths from the library rather than accepting arbitrary paths or folders', async () => {
	await expect(droppedLibraryFiles('["notes.md","folder","/outside/secret"]')).resolves.toEqual([file]);
	await expect(droppedLibraryFiles('{"path":"notes.md"}')).resolves.toEqual([]);
	await expect(droppedLibraryFiles('invalid')).rejects.toThrow();
});
