// Every OrganUI component the script renders: its docs group, how it is placed
// (fill: full-bleed stage, stretch: full width, center: natural size) and its required props.
// ponytail: the 3D organ, disease and molecule viewers are left out; they load models over
// the network, which the script frame blocks. Bundle the GLBs to add them.
const group = (name, place, entries) =>
	Object.fromEntries(
		Object.entries(entries).map(([id, required]) => [id, { group: name, place: required.place ?? place, required: required.props ?? required }])
	);

export const CATALOG = {
	...group('clinical', 'stretch', {
		'body-map': [], 'dermatome-map': [], 'patient-banner': ['patient'], 'allergy-list': [], 'problem-list': ['problems'],
		'vital-signs': ['readings'], 'news2-chart': ['observations'], 'lab-results': ['results'],
		'medication-schedule': ['medications', 'date'], 'ecg-trace': [], 'growth-chart': ['standards', 'measure', 'sex'],
	}),
	...group('anatomy', 'stretch', {
		'anatomy-tree': ['data'], 'image-viewer': { props: [], place: 'fill' },
	}),
};

export const COMPONENTS = Object.keys(CATALOG);
