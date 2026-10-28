// Every dithercn component the script renders: its docs group, how it is placed
// (fill: full-bleed background, stretch: full width, center: natural size) and its required props.
const group = (name, place, entries) =>
	Object.fromEntries(
		Object.entries(entries).map(([id, required]) => [id, { group: name, place: required.place ?? place, required: required.props ?? required }])
	);

export const CATALOG = {
	...group('backgrounds', 'fill', {
		'dither-gradient': [], 'dither-glow': [], 'mesh-gradient': [], aurora: [], 'noise-field': [], waves: [],
		plasma: [], beams: [], silk: [], smoke: [], contours: [], ripples: [], ridgelines: [], metaballs: [],
		tunnel: [], 'retro-grid': [], eclipse: [], horizon: [], starfield: [], halftone: [], 'dither-globe': [],
		'dot-map': [], 'dither-orb': [], 'dither-fade': [],
		shader: ['field'],
	}),
	...group('charts', 'stretch', {
		'area-chart': ['data', 'x', 'series'], 'bar-chart': ['data', 'x', 'series'], 'line-chart': ['data', 'x', 'series'],
		sparkline: ['data', 'label'], heatmap: ['data'], 'donut-chart': { props: ['data', 'label'], place: 'center' },
		'radar-chart': { props: ['axes', 'series'], place: 'center' }, gauge: { props: ['value', 'label'], place: 'center' },
		'progress-bar': ['label'], 'uptime-bar': ['label', 'days'], 'stat-card': ['label', 'value'],
	}),
	...group('interface', 'center', {
		'dither-button': [], avatar: ['name'], 'dither-card': { props: [], place: 'stretch' }, divider: { props: [], place: 'stretch' },
		skeleton: { props: [], place: 'stretch' }, loader: [], 'empty-state': { props: ['title'], place: 'stretch' },
		'not-found': { props: [], place: 'stretch' },
	}),
	...group('text', 'center', {
		'dither-text': ['children'], 'dissolve-text': ['children'], 'scramble-text': ['children'], 'dither-number': ['value'],
	}),
	...group('images', 'stretch', {
		'dither-image': ['src', 'alt'], 'image-compare': ['src', 'alt'], 'scroll-reveal-image': ['src', 'alt'],
		'dithered-logo': { props: ['src', 'alt'], place: 'center' }, 'logo-marquee': ['logos'],
	}),
};

export const COMPONENTS = Object.keys(CATALOG);
