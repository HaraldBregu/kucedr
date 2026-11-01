import { useRef, useState, type ReactElement } from 'react';
import type { Map as LeafletMap } from 'leaflet';
import { Maximize2 } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { mapSchema } from '../../../../../shared/map';
import type { AgentToolPart } from '../context';
import { MapView } from './MapView';
import { ToolActivityGroup } from './ToolActivityGroup';

export function MapCard({ tool }: { tool: AgentToolPart }): ReactElement {
	const mapRef = useRef<LeafletMap>(null);
	const [open, setOpen] = useState(false);
	const [view, setView] = useState<{ latitude: number; longitude: number; zoom: number }>();
	if (tool.state !== 'output-available') return <ToolActivityGroup tools={[tool]} />;
	let output = tool.output;
	if (typeof output === 'string') {
		try {
			output = JSON.parse(output);
		} catch {
			return <ToolActivityGroup tools={[tool]} />;
		}
	}
	const parsed = mapSchema.safeParse(output);
	if (!parsed.success) return <ToolActivityGroup tools={[tool]} />;
	const map = parsed.data;
	return (
		<>
			<div className="w-full overflow-hidden rounded-xl border border-border">
				{map.title && <div className="px-3 py-2 text-sm font-medium">{map.title}</div>}
				<div className="relative isolate">
					<MapView map={map} mapRef={mapRef} className="h-80 w-full" />
					<Button
						variant="secondary"
						size="icon-sm"
						className="absolute right-3 top-3 z-[1000]"
						aria-label="Expand map"
						title="Expand map"
						onClick={() => {
							const current = mapRef.current;
							if (current) {
								const center = current.getCenter();
								setView({ latitude: center.lat, longitude: center.lng, zoom: current.getZoom() });
							}
							setOpen(true);
						}}
					>
						<Maximize2 />
					</Button>
				</div>
			</div>
			<Dialog open={open} onOpenChange={setOpen}>
				<DialogContent className="sm:max-w-5xl">
					<DialogHeader className="min-w-0 pr-10">
						<DialogTitle className="truncate">{map.title ?? 'Map'}</DialogTitle>
					</DialogHeader>
					<MapView
						map={{ ...map, ...view }}
						className="h-[min(70vh,48rem)] w-full overflow-hidden rounded-md"
					/>
				</DialogContent>
			</Dialog>
		</>
	);
}
