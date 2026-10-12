const { STATUS, ADDRESS_VISIBLE } = require('./status');
const { coordsToLatLng, isPlausible } = require('./geo');

/**
 * The payload that goes to a shared order room — customer, restaurant and courier
 * all receive exactly this object, so it must carry no personal data. The address
 * and contact number live only in `courierJobView`, which is emitted to the assigned
 * courier's personal room while the order is active.
 */
function orderPublicView(order) {
  if (!order) return null;
  const o = order.toObject ? order.toObject({ virtuals: true }) : order;
  return {
    id: String(o._id || o.id),
    status: o.status,
    restaurantId: o.restaurantId ? String(o.restaurantId._id || o.restaurantId) : null,
    restaurantName: o.restaurantId?.name || o.restaurantName || null,
    restaurantLocation: o.restaurantId?.location ? coordsToLatLng(o.restaurantId.location.coordinates) : null,
    courierId: o.courierId ? String(o.courierId._id || o.courierId) : null,
    courierName: o.courierName || (o.courierId && o.courierId.name) || null,
    courierVehicle: o.courierId?.vehicle || o.courierVehicle || null,
    courierLocation: o.courierLocation || null,
    courierTrail: (o.courierTrail || []).map((p) => ({ lat: p.lat, lng: p.lng, at: p.at })),
    items: o.items || [],
    subtotalCents: o.subtotalCents,
    deliveryFeeCents: o.deliveryFeeCents,
    serviceFeeCents: o.serviceFeeCents,
    totalCents: o.totalCents,
    eta: o.eta || null,
    distanceMeters: o.distanceMeters ?? null,
    offer: {
      state: o.offer?.state || 'NONE',
      attempts: (o.offer?.attempts || []).length,
      expiresAt: o.offer?.expiresAt || null
    },
    statusHistory: (o.statusHistory || []).map((e) => ({
      status: e.status,
      at: e.at,
      actor: e.actor,
      note: e.note || ''
    })),
    timestamps: {
      placedAt: o.placedAt || null,
      paidAt: o.paidAt || null,
      acceptedAt: o.acceptedAt || null,
      readyAt: o.readyAt || null,
      assignedAt: o.assignedAt || null,
      pickedUpAt: o.pickedUpAt || null,
      deliveredAt: o.deliveredAt || null,
      completedAt: o.completedAt || null,
      closedAt: o.closedAt || null
    },
    rejectReason: o.rejectReason || '',
    cancelReason: o.cancelReason || '',
    rated: o.rated || { restaurant: false, courier: false },
    notes: o.notes || ''
  };
}

/** Personal-room payload for the assigned courier: this is the only place PII appears. */
function courierJobView(order, courier, restaurant) {
  const o = order.toObject ? order.toObject({ virtuals: true }) : order;
  const base = orderPublicView(order);
  const visible = ADDRESS_VISIBLE.includes(o.status);
  return {
    ...base,
    job: {
      pickup: restaurant
        ? {
            name: restaurant.name,
            address: restaurant.address,
            phone: restaurant.phone,
            lat: restaurant.location.coordinates[1],
            lng: restaurant.location.coordinates[0]
          }
        : null,
      dropoff: visible
        ? { ...(o.deliveryAddress || {}), contactPhone: o.contactPhone || '' }
        : null,
      customerName: visible ? o.customerName || null : null,
      addressVisible: visible,
      courierFeeCents: o.courierFeeCents || 0,
      distanceMeters: o.distanceMeters ?? null
    },
    courier: courier
      ? {
          id: String(courier._id),
          name: courier.name,
          vehicle: courier.vehicle,
          isOnline: courier.isOnline,
          activeOrders: courier.activeOrders
        }
      : null
  };
}

function courierPublicView(courier) {
  if (!courier) return null;
  const coords = courier.lastKnownLocation?.coordinates;
  const stored = coords ? { lat: coords[1], lng: coords[0] } : null;
  const located = stored && isPlausible(stored) ? stored : null;
  return {
    id: String(courier._id),
    userId: String(courier.userId),
    name: courier.name,
    vehicle: courier.vehicle,
    isOnline: courier.isOnline,
    activeOrders: courier.activeOrders,
    ratingStars: courier.ratingStars,
    ratingCount: courier.ratingCount,
    completedDeliveries: courier.completedDeliveries,
    lat: located ? located.lat : null,
    lng: located ? located.lng : null,
    locationUpdatedAt: courier.locationUpdatedAt || null
  };
}

function restaurantPublicView(restaurant) {
  const r = restaurant.toObject ? restaurant.toObject({ virtuals: true }) : restaurant;
  const menu = (r.menu || []).map((section) => ({
    id: String(section._id),
    name: section.name,
    items: (section.items || []).map((item) => ({
      id: String(item._id),
      name: item.name,
      description: item.description,
      priceCents: item.priceCents,
      available: item.available,
      prepMinutes: item.prepMinutes,
      emoji: item.emoji
    }))
  }));
  return {
    id: String(r._id),
    name: r.name,
    cuisine: r.cuisine,
    description: r.description,
    emoji: r.emoji,
    tint: r.tint,
    phone: r.phone,
    address: r.address,
    isOpen: r.isOpen,
    avgPrepMinutes: Math.round(r.rollingPrepMinutes || r.basePrepMinutes),
    minOrderCents: r.minOrderCents,
    deliveryRadiusMeters: r.deliveryRadiusMeters,
    ratingStars: r.ratingStars,
    ratingCount: r.ratingCount,
    lat: r.location?.coordinates?.[1] ?? null,
    lng: r.location?.coordinates?.[0] ?? null,
    menuSummary: {
      available: menu.reduce((n, s) => n + s.items.filter((i) => i.available).length, 0),
      total: menu.reduce((n, s) => n + s.items.length, 0)
    },
    menu
  };
}

const isActiveStatus = (status) =>
  [STATUS.PAID, STATUS.PREPARING, STATUS.READY, STATUS.ASSIGNED, STATUS.PICKED_UP].includes(status);

module.exports = { orderPublicView, courierJobView, courierPublicView, restaurantPublicView, isActiveStatus };
