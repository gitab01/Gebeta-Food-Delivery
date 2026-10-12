const { STATUS } = require('./status');
const { distanceMeters, travelMinutes } = require('./geo');

const HANDOVER_MINUTES = 4;

/**
 * Remaining prep time. Inside the kitchen's average this counts down; past the
 * average it stops shrinking and climbs by half of the overrun, because a floor
 * of a couple of minutes would advertise an order as nearly-done while the
 * kitchen is demonstrably behind.
 */
function remainingPrepMinutes(prepAverage, prepElapsed) {
  const onTime = Math.max(0, Math.round(prepAverage - prepElapsed));
  const overrun = Math.max(0, Math.round(prepElapsed - prepAverage));
  return Math.max(2, onTime) + Math.ceil(overrun / 2);
}

/**
 * The ETA is never the original promise. It is rebuilt from what has actually
 * happened: the kitchen's rolling prep average, how long it has already been
 * cooking, and where the courier currently is. Each return value carries the
 * reason the customer sees when the number moves.
 */
function buildEta({ now = new Date(), status, order, restaurant, courier, courierLocation } = {}) {
  const at = (minutes) => ({
    minutes,
    at: new Date(now.getTime() + minutes * 60000).toISOString(),
    reason: '',
    computedAt: now.toISOString()
  });

  const prepAverage = Math.round(restaurant?.rollingPrepMinutes || restaurant?.basePrepMinutes || 20);
  const vehicle = courier?.vehicle || 'motorbike';
  const restaurantLatLng = restaurant?.location?.coordinates
    ? { lat: restaurant.location.coordinates[1], lng: restaurant.location.coordinates[0] }
    : null;
  const customerLatLng = order?.deliveryAddress?.lat != null
    ? { lat: order.deliveryAddress.lat, lng: order.deliveryAddress.lng }
    : null;
  const toCustomer = travelMinutes(distanceMeters(restaurantLatLng, customerLatLng), vehicle, HANDOVER_MINUTES);

  if (status === STATUS.PICKED_UP) {
    const metres = distanceMeters(courierLocation, customerLatLng) || 0;
    const minutes = travelMinutes(metres, vehicle, 2);
    const away = metres < 1000 ? `${Math.round(metres)} m` : `${(metres / 1000).toFixed(1)} km`;
    return { ...at(minutes), reason: `On the road — ${away} from the drop-off` };
  }

  if (status === STATUS.ASSIGNED || status === STATUS.READY) {
    const toRestaurant = travelMinutes(distanceMeters(courierLocation, restaurantLatLng), vehicle, 1);
    const prepElapsed = order?.prepStartedAt
      ? Math.max(0, (now.getTime() - new Date(order.prepStartedAt).getTime()) / 60000)
      : 0;
    const remainingPrep = status === STATUS.READY ? 0 : remainingPrepMinutes(prepAverage, prepElapsed);
    const minutes = remainingPrep + toRestaurant + toCustomer;
    const reason =
      status === STATUS.READY
        ? `Food is ready — courier is ${toRestaurant} min from the restaurant`
        : `Kitchen running ${prepAverage} min average, courier ${toRestaurant} min away`;
    return { ...at(minutes), reason };
  }

  if (status === STATUS.PREPARING) {
    const prepElapsed = order?.prepStartedAt
      ? Math.max(0, (now.getTime() - new Date(order.prepStartedAt).getTime()) / 60000)
      : 0;
    const remainingPrep = remainingPrepMinutes(prepAverage, prepElapsed);
    const minutes = remainingPrep + toCustomer + (order?.courierId ? 0 : 4);
    const reason =
      prepElapsed > prepAverage
        ? `Prep is running ${Math.round(prepElapsed - prepAverage)} min past this kitchen's average`
        : `Cooking now — ${prepAverage} min average for this kitchen`;
    return { ...at(minutes), reason };
  }

  if (status === STATUS.DELIVERED || status === STATUS.COMPLETED) {
    return { minutes: 0, at: now.toISOString(), reason: 'Delivered', computedAt: now.toISOString() };
  }

  // PLACED / PAID: nothing measured yet, so the estimate is the kitchen's own number.
  return { ...at(prepAverage + toCustomer), reason: `Estimated from ${prepAverage} min average prep plus ${toCustomer} min delivery` };
}

/** Rolling prep average over the restaurant's recent completed orders. */
function rollingPrepMinutes(samples, fallback) {
  const valid = (samples || []).filter((n) => Number.isFinite(n) && n > 2 && n < 240);
  if (valid.length < 3) return Math.round(fallback);
  const recent = valid.slice(-20);
  const mean = recent.reduce((a, b) => a + b, 0) / recent.length;
  return Math.round(mean);
}

module.exports = { buildEta, rollingPrepMinutes, HANDOVER_MINUTES };
