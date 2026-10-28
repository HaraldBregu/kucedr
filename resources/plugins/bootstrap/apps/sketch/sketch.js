(async () => {
	const { Editor, EditorEventType, Erase, makeEdgeToolbar } = window.jsdraw;
	const editor = new Editor(document.body, {
		appInfo: { name: 'Sketch', description: 'Freehand drawing for Kucedr.', version: '1.1.0' },
	});
	editor.getRootElement().style.height = '100%';

	const download = (name, url) => {
		const link = document.createElement('a');
		link.download = name;
		link.href = url;
		link.click();
	};

	const toolbar = makeEdgeToolbar(editor);
	toolbar.addDefaults();
	toolbar.addActionButton({ label: 'Export PNG', icon: editor.icons.makeSaveIcon() }, () =>
		download('sketch.png', editor.toDataURL('image/png'))
	);
	toolbar.addActionButton({ label: 'Export SVG', icon: editor.icons.makeSaveIcon() }, () =>
		download('sketch.svg', `data:image/svg+xml;charset=utf-8,${encodeURIComponent(editor.toSVG().outerHTML)}`)
	);
	toolbar.addActionButton({ label: 'Clear', icon: editor.icons.makeDeleteSelectionIcon() }, () =>
		editor.dispatch(new Erase(editor.image.getAllComponents()))
	);
	toolbar.addActionButton({ label: 'About', icon: editor.icons.makeHelpIcon() }, () =>
		editor.showAboutDialog()
	);

	const saved = await window.store.get('drawing');
	if (typeof saved === 'string') await editor.loadFromSVG(saved);
	else editor.dispatchNoAnnounce(editor.image.setAutoresizeEnabled(true), false);

	const save = () => window.store.set('drawing', editor.toSVG().outerHTML);
	editor.notifier.on(EditorEventType.CommandDone, save);
	editor.notifier.on(EditorEventType.CommandUndone, save);
	editor.focus();
})();
