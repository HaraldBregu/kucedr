(async () => {
	const { Editor, EditorEventType } = window.jsdraw;
	const editor = new Editor(document.body);
	editor.addToolbar();
	editor.getRootElement().style.height = '100%';

	const saved = await window.store.get('drawing');
	if (typeof saved === 'string') await editor.loadFromSVG(saved);

	const save = () => window.store.set('drawing', editor.toSVG().outerHTML);
	editor.notifier.on(EditorEventType.CommandDone, save);
	editor.notifier.on(EditorEventType.CommandUndone, save);
})();
