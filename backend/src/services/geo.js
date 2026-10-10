const EARTH_RADIUS_M = 6371000;
const toRad = (deg) => (deg * Math.PI) / 180;

/** Great-circle distance in metres between {lat,lng} pairs. */
function distanceMeters(a, b) {
  if (!a || !b || a.lat == null || b.lat == null) return null;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h))));
}

const SPEED_KMH = { foot: 4.5, bicycle: 14, motorbike: 24, car: 21 };

/** Door-to-door travel minutes: street distance is ~1.35x straight-line, plus a fixed handover cost. */
function travelMinutes(meters, vehicle = 'motorbike', bufferMinutes = 3) {
  if (meters == null) return bufferMinutes;
  const km = (meters * 1.35) / 1000;
  const speed = SPEED_KMH[vehicle] || SPEED_KMH.motorbike;
  return Math.max(1, Math.round(km / speed * 60 + bufferMinutes));
}

const point = (lat, lng) => ({ type: 'Point', coordinates: [lng, lat] });
const coordsToLatLng = (coordinates) => ({ lat: coordinates[1], lng: coordinates[0] });

module.exports = { distanceMeters, travelMinutes, point, coordsToLatLng, SPEED_KMH };
