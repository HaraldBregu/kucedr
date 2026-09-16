import { Copy, Minus, RotateCcw, Square, X } from 'lucide-react';
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
	sidebarOpen: boolean;
}

export function Header({ model, connected, hasImage, onReset, sidebarOpen }: HeaderProps) {
	const [maximized, setMaximized] = useState(false);

	useEffect(() => {
		if (!isKucedr()) return;
		void win.isMaximized().then(setMaximized);
		return win.onMaximizeChange(setMaximized);
	}, []);

	return (
		<header
			className={`app-header${isMac ? ' mac-titlebar' : ''}${sidebarOpen ? '' : ' sidebar-collapsed'}`}
			style={{ WebkitAppRegion: 'drag' } as CSSProperties}
		>
			<strong className="header-title">Architect</strong>
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
					<button
						className="icon-button"
						onClick={win.minimize}
						aria-label="Minimize window"
						title="Minimize"
					>
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
					<button
						className="icon-button"
						onClick={win.close}
						aria-label="Close window"
						title="Close"
					>
						<X size={15} />
					</button>
				</div>
			) : null}
		</header>
	);
}
