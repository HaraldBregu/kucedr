import { Check, Crop, History } from 'lucide-react';
import type { ArchitectVersion, CropSettings } from '../types';

interface VersionsProps {
	versions: ArchitectVersion[];
	currentId?: string;
	cropMode: boolean;
	crop: CropSettings;
	busy: boolean;
	onSelect: (id: string) => void;
	onChange: (field: keyof CropSettings, value: string | number) => void;
	onApply: () => void;
	onCancel: () => void;
}

export function Versions({ versions, currentId, cropMode, crop, busy, onSelect, onChange, onApply, onCancel }: VersionsProps) {
	if (cropMode) {
		return (
		<aside id="concepts" className="versions-panel crop-panel panel">
				<div className="panel-title">
					<div><strong>Crop image</strong><span>Frame a new version</span></div>
					<Crop size={15} />
				</div>
				<div className="panel-scroll crop-controls">
					<fieldset>
						<legend>Aspect ratio</legend>
						<div className="ratio-grid">
							{(['original', '1:1', '4:3', '3:2', '16:9'] as const).map((ratio) => (
								<button key={ratio} className={crop.ratio === ratio ? 'active' : ''} onClick={() => onChange('ratio', ratio)}>
									{ratio === 'original' ? 'Original' : ratio}
								</button>
							))}
						</div>
					</fieldset>
					<label><span>Zoom <b>{crop.zoom.toFixed(1)}×</b></span><input type="range" min="1" max="3" step="0.1" value={crop.zoom} onChange={(event) => onChange('zoom', Number(event.target.value))} /></label>
					<label><span>Horizontal <b>{crop.x}</b></span><input type="range" min="-100" max="100" value={crop.x} onChange={(event) => onChange('x', Number(event.target.value))} /></label>
					<label><span>Vertical <b>{crop.y}</b></span><input type="range" min="-100" max="100" value={crop.y} onChange={(event) => onChange('y', Number(event.target.value))} /></label>
				</div>
				<div className="panel-actions">
					<button className="primary" disabled={busy} onClick={onApply}><Check size={14} /> Apply crop</button>
					<button onClick={onCancel}>Cancel</button>
				</div>
			</aside>
		);
	}

	return (
		<aside id="concepts" className="versions-panel panel">
			<div className="panel-title">
				<div><strong>Concept history</strong><span>{versions.length ? `${versions.length} in this session` : 'No concepts yet'}</span></div>
				<History size={15} />
			</div>
			<div className="panel-scroll version-list">
				{versions.map((version, index) => (
					<button key={version.id} className={currentId === version.id || (!currentId && index === 0) ? 'selected' : ''} onClick={() => onSelect(version.id)}>
						<img src={version.url} alt="" />
						<span><strong>{version.label}</strong><small>{version.prompt}</small></span>
					</button>
				))}
				{versions.length === 0 && <div className="empty-versions">Each concept, crop, and revision appears here.</div>}
			</div>
		</aside>
	);
}
