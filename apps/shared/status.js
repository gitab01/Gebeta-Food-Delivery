/** The status vocabulary, kept in one place so the two apps never disagree. */

export const ORDER = ['PLACED', 'PAID', 'PREPARING', 'READY', 'ASSIGNED', 'PICKED_UP', 'DELIVERED', 'COMPLETED'];

export const LABEL = {
  PLACED: 'Placed',
  PAID: 'Paid',
  PREPARING: 'Cooking',
  READY: 'Ready for pickup',
  ASSIGNED: 'Courier on the way',
  PICKED_UP: 'On the road',
  DELIVERED: 'Delivered',
  COMPLETED: 'Completed',
  REJECTED: 'Declined by kitchen',
  CANCELLED: 'Cancelled'
};

export const SHORT = {
  PLACED: 'Placed',
  PAID: 'Paid',
  PREPARING: 'Cooking',
  READY: 'Ready',
  ASSIGNED: 'Assigned',
  PICKED_UP: 'Delivering',
  DELIVERED: 'Delivered',
  COMPLETED: 'Done',
  REJECTED: 'Declined',
  CANCELLED: 'Cancelled'
};

export const TERMINAL = ['COMPLETED', 'REJECTED', 'CANCELLED'];

/** Six characters or less: the only labels narrow enough for the eight-step rail on a phone. */
export const RAIL = {
  PLACED: 'Placed',
  PAID: 'Paid',
  PREPARING: 'Cook',
  READY: 'Ready',
  ASSIGNED: 'Rider',
  PICKED_UP: 'Pickup',
  DELIVERED: 'Done',
  COMPLETED: 'Closed',
  REJECTED: 'Declined',
  CANCELLED: 'Void'
};

export const stageIndex = (status) => ORDER.indexOf(status);
