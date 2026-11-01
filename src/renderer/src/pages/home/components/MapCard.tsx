import type { ReactElement } from 'react';
import { CircleMarker, MapContainer, Popup, TileLayer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { mapSchema } from '../../../../../shared/map';
import type { AgentToolPart } from '../context';
import { ToolActivityGroup } from './ToolActivityGroup';

export function MapCard({ tool }: { tool: AgentToolPart }): ReactElement {
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
		<div className="w-full overflow-hidden rounded-xl border border-border">
			{map.title && <div className="px-3 py-2 text-sm font-medium">{map.title}</div>}
			<MapContainer
				center={[map.latitude, map.longitude]}
				zoom={map.zoom ?? 13}
				scrollWheelZoom={false}
				className="h-80 w-full"
				aria-label={map.title ?? 'Map'}
			>
				<TileLayer
					attribution={
						'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
					}
					url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
				/>
				{map.markers?.map((marker, index) => (
					<CircleMarker key={index} center={[marker.latitude, marker.longitude]} radius={7}>
						{marker.label && <Popup>{marker.label}</Popup>}
					</CircleMarker>
				))}
			</MapContainer>
		</div>
	);
}
