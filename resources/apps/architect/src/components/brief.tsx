import { Box, Building2, Home, Sparkles, Upload } from 'lucide-react';
import type { DesignDiscipline, GenerationBrief } from '../types';

const subjects = {
	interior: ['living room', 'kitchen', 'bedroom suite', 'home office', 'restaurant interior', 'hotel lobby', 'retail interior'],
	exterior: ['private residence', 'villa facade', 'apartment building', 'courtyard', 'landscape entry', 'hospitality exterior'],
	industrial: ['lounge chair', 'table lamp', 'desk system', 'kitchen appliance', 'portable speaker', 'mobility object'],
} as const;
const disciplines: Array<{ value: DesignDiscipline; label: string; icon: typeof Home }> = [
	{ value: 'interior', label: 'Interior', icon: Home },
	{ value: 'exterior', label: 'Exterior', icon: Building2 },
	{ value: 'industrial', label: 'Industrial', icon: Box },
];

interface BriefProps {
	brief: GenerationBrief;
	disabled: boolean;
	connected: boolean;
	onChange: (field: keyof GenerationBrief, value: string) => void;
	onDisciplineChange: (discipline: DesignDiscipline) => void;
	onGenerate: () => void;
	onImport: (file: File) => void;
}

export function Brief({ brief, disabled, connected, onChange, onDisciplineChange, onGenerate, onImport }: BriefProps) {
	return (
		<aside className="brief-panel panel">
			<div className="panel-title"><div><strong>Design brief</strong><span>Set the discipline, intent, and visual direction</span></div></div>
			<div className="panel-scroll form-stack">
				<fieldset>
					<legend>Discipline</legend>
					<div className="discipline-tabs" role="tablist" aria-label="Design discipline">
						{disciplines.map(({ value, label, icon: Icon }) => <button key={value} type="button" role="tab" aria-selected={brief.discipline === value} className={brief.discipline === value ? 'active' : ''} onClick={() => onDisciplineChange(value)}><Icon size={14} />{label}</button>)}
					</div>
				</fieldset>
				<label><span>Design focus</span><select value={brief.subject} onChange={(event) => onChange('subject', event.target.value)}>{subjects[brief.discipline].map((subject) => <option key={subject}>{subject}</option>)}</select></label>
				<label><span>Intent</span><textarea rows={5} value={brief.description} placeholder="Describe the function, experience, and defining design moves…" onChange={(event) => onChange('description', event.target.value)} /></label>
				<label><span>Setting or use</span><textarea rows={2} value={brief.context} onChange={(event) => onChange('context', event.target.value)} /></label>
				<label><span>Design language</span><textarea rows={2} value={brief.style} onChange={(event) => onChange('style', event.target.value)} /></label>
				<label><span>Materials</span><textarea rows={2} value={brief.materials} onChange={(event) => onChange('materials', event.target.value)} /></label>
				<label><span>Light and mood</span><textarea rows={2} value={brief.lighting} onChange={(event) => onChange('lighting', event.target.value)} /></label>
				<fieldset><legend>Frame</legend><div className="segmented">{(['1:1', '4:3', '3:2', '16:9'] as const).map((ratio) => <button key={ratio} type="button" className={brief.ratio === ratio ? 'active' : ''} onClick={() => onChange('ratio', ratio)}>{ratio}</button>)}</div></fieldset>
			</div>
			<div className="panel-actions"><button className="primary" disabled={disabled || !connected} onClick={onGenerate}><Sparkles size={15} /> Generate concept</button><label className="button secondary"><Upload size={15} /> Import<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => { const file = event.target.files?.[0]; if (file) onImport(file); event.target.value = ''; }} /></label></div>
		</aside>
	);
}
