import { convertToExcalidrawElements, exportToSvg } from '@excalidraw/excalidraw';

const input = JSON.parse(document.getElementById('draw-input').textContent);
const container = document.getElementById('draw');

async function render() {
	await document.fonts.load('20px Virgil');
	const elements = convertToExcalidrawElements(
		input.elements.map((element, index) => ({
			...element,
			seed: element.seed ?? index + 1,
			fontFamily: 1,
			...(element.label ? { label: { ...element.label, fontFamily: 1 } } : {}),
		})),
		{ regenerateIds: false }
	);
	const svg = await exportToSvg({
		elements,
		appState: {
			exportBackground: false,
			exportWithDarkMode: document.documentElement.style.colorScheme === 'dark',
		},
		exportPadding: 20,
		skipInliningFonts: true,
	});
	svg.setAttribute('aria-hidden', 'true');
	container.replaceChildren(svg);
}

render().catch((error) => {
	container.setAttribute('role', 'alert');
	container.textContent = `Could not render: ${error.message}`;
});
