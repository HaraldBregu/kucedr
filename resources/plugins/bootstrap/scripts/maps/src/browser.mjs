import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const input = JSON.parse(document.getElementById('maps-input').textContent);
const map = L.map('map', { scrollWheelZoom: false }).setView([input.latitude, input.longitude], input.zoom ?? 13);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
	attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
}).addTo(map);
for (const marker of input.markers ?? []) {
	const circle = L.circleMarker([marker.latitude, marker.longitude], { radius: 7 }).addTo(map);
	if (!marker.label) continue;
	const label = document.createElement('span');
	label.textContent = marker.label;
	circle.bindPopup(label);
}
