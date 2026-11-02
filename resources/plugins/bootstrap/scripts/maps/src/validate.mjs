const inRange = (value, limit) => Number.isFinite(value) && Math.abs(value) <= limit;

export function validate(input) {
	if (!input || typeof input !== 'object' || Array.isArray(input))
		throw new Error('input must be an object.');
	if (!inRange(input.latitude, 90)) throw new Error('latitude must be a number from -90 to 90.');
	if (!inRange(input.longitude, 180)) throw new Error('longitude must be a number from -180 to 180.');
	if (input.zoom !== undefined && !(Number.isInteger(input.zoom) && input.zoom >= 0 && input.zoom <= 19))
		throw new Error('zoom must be an integer from 0 to 19.');
	if (input.title !== undefined && typeof input.title !== 'string')
		throw new Error('title must be a string when provided.');
	if (input.markers === undefined) return;
	if (!Array.isArray(input.markers) || input.markers.length > 100)
		throw new Error('markers must be a list of at most 100 entries.');
	for (const marker of input.markers) {
		if (!marker || !inRange(marker.latitude, 90) || !inRange(marker.longitude, 180))
			throw new Error('every marker needs a valid latitude and longitude.');
		if (marker.label !== undefined && typeof marker.label !== 'string')
			throw new Error('marker label must be a string.');
	}
}
