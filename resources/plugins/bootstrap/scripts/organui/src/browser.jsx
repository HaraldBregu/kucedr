import { Component } from 'react';
import { createRoot } from 'react-dom/client';
import { CATALOG } from './catalog.mjs';
import { REGISTRY } from './registry.jsx';

const PLACES = {
	fill: 'relative min-h-0 flex-1 overflow-hidden rounded-lg',
	stretch: 'flex min-h-0 flex-1 flex-col justify-center-safe overflow-auto [scrollbar-width:thin]',
	center: 'flex min-h-0 flex-1 items-center-safe justify-center-safe overflow-auto [scrollbar-width:thin]',
};

class Boundary extends Component {
	state = { error: null };
	static getDerivedStateFromError(error) {
		return { error };
	}
	render() {
		if (!this.state.error) return this.props.children;
		return <p className="m-auto text-destructive">Could not render: {this.state.error.message}</p>;
	}
}

const { component, props = {} } = JSON.parse(document.getElementById('organui-input').textContent);
const View = REGISTRY[component];
const { place } = CATALOG[component];

if (place === 'fill') {
	document.documentElement.classList.add('fill');
} else {
	new ResizeObserver(() =>
		parent.postMessage(
			{ type: 'kucedr:script-height', height: Math.ceil(document.documentElement.getBoundingClientRect().height) },
			'*'
		)
	).observe(document.documentElement);
}

createRoot(document.getElementById('organui')).render(
	<Boundary>
		<div className={PLACES[place]}>
			<View {...props} className={place === 'fill' ? 'absolute inset-0' : props.className} />
		</div>
	</Boundary>
);
