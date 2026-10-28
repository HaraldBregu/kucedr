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

	const icon = (markup) => {
		const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
		svg.setAttribute('viewBox', '0 0 100 100');
		svg.innerHTML = markup;
		return svg;
	};
	const stroke = 'fill="none" stroke="var(--icon-color)" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"';
	const exportIcon = (format) =>
		icon(
			`<path ${stroke} d="M50 8V48M32 32L50 50L68 32M22 58H78"/><text x="50" y="90" text-anchor="middle" fill="var(--icon-color)" style="font: bold 26px system-ui, sans-serif">${format}</text>`
		);

	const toolbar = makeEdgeToolbar(editor);
	toolbar.addDefaults();
	toolbar.addActionButton({ label: 'Export PNG', icon: exportIcon('PNG') }, () =>
		download('sketch.png', editor.toDataURL('image/png'))
	);
	toolbar.addActionButton({ label: 'Export SVG', icon: exportIcon('SVG') }, () =>
		download('sketch.svg', `data:image/svg+xml;charset=utf-8,${encodeURIComponent(editor.toSVG().outerHTML)}`)
	);
	toolbar.addActionButton(
		{ label: 'Clear', icon: icon(`<path ${stroke} d="M20 28H80M40 28V16H60V28M28 28L33 86H67L72 28M44 42V72M56 42V72"/>`) },
		() => editor.dispatch(new Erase(editor.image.getAllComponents()))
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
