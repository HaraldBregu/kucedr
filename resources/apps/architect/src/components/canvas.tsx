import { useState } from 'react';
import { Crop, Download, ImagePlus, Send, Sparkles } from 'lucide-react';
import type { ArchitectVersion, CropSettings, DesignDiscipline } from '../types';

interface CanvasProps {
	current?: ArchitectVersion;
	busy?: string;
	message: string;
	cropMode: boolean;
	crop: CropSettings;
	discipline: DesignDiscipline;
	onCrop: () => void;
	onDownload: () => void;
	onRevise: (instruction: string) => Promise<void>;
}

export function Canvas({ current, busy, message, cropMode, crop, discipline, onCrop, onDownload, onRevise }: CanvasProps) {
	const [instruction, setInstruction] = useState('');
	const cropRatio = crop.ratio === 'original' ? undefined : crop.ratio.replace(':', ' / ');

	return (
		<section className="canvas-panel">
			<div className="canvas-toolbar">
				<span>{current?.label ?? 'Untitled concept'}</span>
				<div />
				<button className={cropMode ? 'active' : ''} disabled={!current || Boolean(busy)} onClick={onCrop}>
					<Crop size={14} /> Crop
				</button>
				<button disabled={!current} onClick={onDownload}>
					<Download size={14} /> Export
				</button>
			</div>
			<div className="canvas-stage">
				{current ? (
					<div
						className={cropMode ? 'image-frame cropping' : 'image-frame'}
						style={cropRatio ? { aspectRatio: cropRatio } : undefined}
					>
						<img
							src={current.url}
							alt={current.prompt || `${discipline} design visualization`}
							style={
								cropMode
									? {
										transform: `scale(${crop.zoom}) translate(${crop.x / 5}%, ${crop.y / 5}%)`,
									}
									: undefined
							}
						/>
					</div>
				) : (
					<div className="empty-canvas">
						<div><ImagePlus size={25} /></div>
						<strong>Start a design concept</strong>
						<span>Build an interior, exterior, or industrial design brief, or import a reference image.</span>
					</div>
				)}
				{busy && (
					<div className="busy-overlay">
						<Sparkles size={18} />
						<span>{busy}</span>
					</div>
				)}
			</div>
			<div className="revision-bar">
				<div className="status-line">{message}</div>
				<div className="revision-input">
					<textarea
						rows={2}
						value={instruction}
						disabled={!current || Boolean(busy)}
						placeholder="Describe the next revision — refine the form, adjust materials, evolve the light…"
						onChange={(event) => setInstruction(event.target.value)}
						onKeyDown={(event) => {
							if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
								event.preventDefault();
								void onRevise(instruction).then(() => setInstruction(''));
							}
						}}
					/>
					<button
						className="primary icon-button"
						disabled={!current || !instruction.trim() || Boolean(busy)}
						onClick={() => void onRevise(instruction).then(() => setInstruction(''))}
						title="Apply revision"
					>
						<Send size={15} />
						<span className="sr-only">Apply revision</span>
					</button>
				</div>
			</div>
		</section>
	);
}
