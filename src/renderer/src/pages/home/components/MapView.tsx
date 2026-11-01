import type { ReactElement, Ref } from 'react';
import type { Map as LeafletMap } from 'leaflet';
import { CircleMarker, MapContainer, Popup, TileLayer } from 'react-leaflet';
import type { z } from 'zod';
import { mapSchema } from '../../../../../shared/map';

export function MapView({
	map,
	mapRef,
	className,
}: {
	map: z.infer<typeof mapSchema>;
	mapRef?: Ref<LeafletMap>;
	className: string;
}): ReactElement {
	return (
		<MapContainer
			ref={mapRef}
			center={[map.latitude, map.longitude]}
			zoom={map.zoom ?? 13}
			scrollWheelZoom={false}
			className={className}
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
	);
}
