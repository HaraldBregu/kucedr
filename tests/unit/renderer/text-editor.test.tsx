import { render, waitFor } from '@testing-library/react';
import { useEditor } from '@tiptap/react';
import { TextEditor } from '@/components/text-editor';

jest.mock('@tiptap/extensions', () => ({
	Placeholder: { configure: jest.fn(() => ({})) },
}));
jest.mock('@tiptap/markdown', () => ({ Markdown: {} }));
jest.mock('@tiptap/starter-kit', () => ({ __esModule: true, default: {} }));
jest.mock('@tiptap/react', () => ({
	EditorContent: () => null,
	useEditor: jest.fn(),
}));

describe('TextEditor', () => {
	it('reports wrapped lines after a controlled value update', async () => {
		const editorElement = document.createElement('div');
		let editorValue = '';
		let pendingValue = '';
		const chain = {
			setContent: jest.fn((value: string) => {
				pendingValue = value;
				return chain;
			}),
			focus: jest.fn(() => chain),
			run: jest.fn(() => {
				editorValue = pendingValue;
				editorElement.textContent = pendingValue;
			}),
		};
		const editor = {
			view: { dom: editorElement },
			state: { doc: { descendants: jest.fn() } },
			chain: jest.fn(() => chain),
			getMarkdown: jest.fn(() => editorValue),
			isFocused: false,
			setEditable: jest.fn(),
		};
		jest.mocked(useEditor).mockReturnValue(editor as never);

		let selectedNode: Node | null = null;
		jest.spyOn(document, 'createRange').mockReturnValue({
			selectNodeContents: (node: Node) => {
				selectedNode = node;
			},
			getClientRects: () => {
				const lineCount = (selectedNode?.textContent?.length ?? 0) > 40 ? 2 : 1;
				return Array.from({ length: lineCount }, (_, index) => ({
					width: 100,
					height: 24,
					top: index * 24,
				})) as unknown as DOMRectList;
			},
		} as Range);

		const onVisualLineChange = jest.fn();
		const { rerender } = render(
			<TextEditor value="" onVisualLineChange={onVisualLineChange} />
		);

		rerender(
			<TextEditor
				value={'A controlled transcript that wraps onto another visual line. '.repeat(3)}
				onVisualLineChange={onVisualLineChange}
			/>
		);

		await waitFor(() => expect(onVisualLineChange).toHaveBeenCalledWith(true));
	});

	it('reinserts the Plan node when controlled prompt text is cleared', () => {
		const editorElement = document.createElement('div');
		const chain = {
			setContent: jest.fn(() => chain),
			insertContentAt: jest.fn(() => chain),
			focus: jest.fn(() => chain),
			run: jest.fn(),
		};
		const editor = {
			view: { dom: editorElement },
			state: {
				doc: {
					descendants: (visit: (node: { type: { name: string } }) => boolean) =>
						visit({ type: { name: 'planCommand' } }),
				},
			},
			chain: jest.fn(() => chain),
			getMarkdown: jest.fn(() => 'submitted plan request'),
			isFocused: true,
			setEditable: jest.fn(),
		};
		jest.mocked(useEditor).mockReturnValue(editor as never);
		jest.spyOn(document, 'createRange').mockReturnValue({
			selectNodeContents: jest.fn(),
			getClientRects: () => [] as unknown as DOMRectList,
		} as unknown as Range);

		render(<TextEditor value="" />);

		expect(chain.insertContentAt).toHaveBeenCalledWith(1, [
			{ type: 'planCommand' },
			{ type: 'text', text: ' ' },
		]);
		expect(chain.focus).toHaveBeenCalledWith('end');
	});

	it('does not reinsert the Goal node when controlled prompt text is cleared', () => {
		const editorElement = document.createElement('div');
		const chain = {
			setContent: jest.fn(() => chain),
			insertContentAt: jest.fn(() => chain),
			focus: jest.fn(() => chain),
			run: jest.fn(),
		};
		const editor = {
			view: { dom: editorElement },
			state: {
				doc: {
					descendants: (visit: (node: { type: { name: string } }) => boolean) =>
						visit({ type: { name: 'goalCommand' } }),
				},
			},
			chain: jest.fn(() => chain),
			getMarkdown: jest.fn(() => '/goal Keep tests green'),
			isFocused: true,
			setEditable: jest.fn(),
		};
		jest.mocked(useEditor).mockReturnValue(editor as never);
		jest.spyOn(document, 'createRange').mockReturnValue({
			selectNodeContents: jest.fn(),
			getClientRects: () => [] as unknown as DOMRectList,
		} as unknown as Range);

		render(<TextEditor value="" />);

		expect(chain.insertContentAt).not.toHaveBeenCalled();
	});
});
