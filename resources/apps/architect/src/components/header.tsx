import { Copy, Building2, Minus, RotateCcw, Square, X } from 'lucide-react';
import { useEffect, useState, type CSSProperties } from 'react';
import { isKucedr, win } from '@kucedr/sdk';

const isMac =
	typeof navigator !== 'undefined' &&
	(navigator.platform === 'MacIntel' || navigator.platform.startsWith('Mac'));

interface HeaderProps {
	model: string;
	connected: boolean;
	hasImage: boolean;
	onReset: () => void;
}

export function Header({ model, connected, hasImage, onReset }: HeaderProps) {
	const [maximized, setMaximized] = useState(false);

	useEffect(() => {
		if (!isKucedr()) return;
		void win.isMaximized().then(setMaximized);
		return win.onMaximizeChange(setMaximized);
	}, []);

	return (
		<header
			className={`app-header${isMac ? ' mac-titlebar' : ''}`}
			style={{ WebkitAppRegion: 'drag' } as CSSProperties}
		>
			<div className="brand-mark" aria-hidden="true">
				<Building2 size={16} strokeWidth={2} />
			</div>
			<div className="brand-copy">
				<strong>Architect</strong>
				<span>Interior image studio</span>
			</div>
			<div className="header-spacer" />
			<span className="model-pill" title={model}>
				<i className={connected ? 'online' : ''} />
				{connected ? model : 'Preview mode'}
			</span>
			<button
				className="icon-button"
				disabled={!hasImage}
				onClick={onReset}
				title="New project"
				style={{ WebkitAppRegion: 'no-drag' } as CSSProperties}
			>
				<RotateCcw size={15} />
				<span className="sr-only">New project</span>
			</button>
			{!isMac && isKucedr() ? (
				<div className="window-controls" style={{ WebkitAppRegion: 'no-drag' } as CSSProperties}>
					<button className="icon-button" onClick={win.minimize} aria-label="Minimize window" title="Minimize">
						<Minus size={15} />
					</button>
					<button
						className="icon-button"
						onClick={win.maximize}
						aria-label={maximized ? 'Restore window' : 'Maximize window'}
						title={maximized ? 'Restore' : 'Maximize'}
					>
						{maximized ? <Copy size={13} /> : <Square size={14} />}
					</button>
					<button className="icon-button" onClick={win.close} aria-label="Close window" title="Close">
						<X size={15} />
					</button>
				</div>
			) : null}
		</header>
	);
}
