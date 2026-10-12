/* eslint-disable no-console */
const mongoose = require('mongoose');
const { connectDb, disconnectDb } = require('./config/db');
const env = require('./config/env');
const User = require('./models/User');
const Restaurant = require('./models/Restaurant');
const Courier = require('./models/Courier');
const Order = require('./models/Order');
const Payment = require('./models/Payment');
const Rating = require('./models/Rating');
const { createOrder, transition } = require('./services/orderService');
const paymentService = require('./services/payment');
const assignment = require('./services/assignment');
const { STATUS, ACTOR } = require('./services/status');

const ACCOUNTS = {
  admin: { phone: '0900000001', name: 'Ops Admin', role: 'admin' },
  owners: [
    { phone: '0911111101', name: 'Selam Bekele', role: 'restaurant', restaurant: 0 },
    { phone: '0911111102', name: 'Dawit Girma', role: 'restaurant', restaurant: 1 },
    { phone: '0911111103', name: 'Helen Tesfaye', role: 'restaurant', restaurant: 2 }
  ],
  customers: [
    { phone: '0922222201', name: 'Abel Assefa', address: { label: 'Home', line: 'Bole, Atlas Rd, near Sunshine Building', city: 'Addis Ababa', lat: 9.0107, lng: 38.7612 } },
    { phone: '0922222202', name: 'Meron Tadesse', address: { label: 'Home', line: 'CMC, Rome Rd behind Beth Israel', city: 'Addis Ababa', lat: 9.0279, lng: 38.7945 } },
    { phone: '0922222203', name: 'Yonas Kebede', address: { label: 'Office', line: 'Piassa, near Square', city: 'Addis Ababa', lat: 9.0347, lng: 38.7514 } }
  ],
  couriers: [
    { phone: '0933333301', name: 'Biruk Alemu', role: 'courier', vehicle: 'motorbike', lat: 9.0121, lng: 38.7596 },
    { phone: '0933333302', name: 'Tigist Worku', role: 'courier', vehicle: 'motorbike', lat: 9.0092, lng: 38.7655 },
    { phone: '0933333303', name: 'Nahom Fikru', role: 'courier', vehicle: 'bicycle', lat: 9.0301, lng: 38.7531 }
  ]
};

const RESTAURANTS = [
  {
    name: 'Gebeta Injera House',
    cuisine: ['Ethiopian', 'Traditional'],
    description: 'Hand-rolled injera, slow-cooked wots and a coffee ceremony at three.',
    emoji: '🍲',
    tint: '#c1121f',
    phone: '0911000001',
    address: 'Bole, Atlas Rd',
    lat: 9.0089,
    lng: 38.7578,
    basePrepMinutes: 18,
    menu: [
      {
        name: 'Combination platters',
        items: [
          { name: 'Gebeta combination', description: 'Shiro, misir, gomen, atkilt and kitfo on injera', priceCents: 62000, prepMinutes: 20, emoji: '🍲' },
          { name: 'Vegan fasting platter', description: 'Six oil-free dishes with house injera', priceCents: 48000, prepMinutes: 16, emoji: '🥗' }
        ]
      },
      {
        name: 'Single dishes',
        items: [
          { name: 'Doro wat', description: 'Chicken simmered overnight in berbere', priceCents: 55000, prepMinutes: 24, emoji: '🍗' },
          { name: 'Shiro wat', description: 'Chickpea stew with serrano pepper', priceCents: 32000, prepMinutes: 12, emoji: '🫘' },
          { name: 'Kitfo', description: 'Minced beef mitmita, served with ayib', priceCents: 58000, prepMinutes: 10, emoji: '🥩' },
          { name: 'Beyaynetu', description: 'Lentils, greens and beetroot, no meat', priceCents: 38000, prepMinutes: 14, emoji: '🥬' }
        ]
      },
      {
        name: 'Drinks',
        items: [
          { name: 'Buna (coffee ceremony)', description: 'Jebena-brewed, three rounds', priceCents: 18000, prepMinutes: 9, emoji: '☕' },
          { name: 'Spris', description: 'Layered mango, avocado and papaya', priceCents: 22000, prepMinutes: 5, emoji: '🥭' }
        ]
      }
    ]
  },
  {
    name: 'Yod Burger Bole',
    cuisine: ['Burgers', 'Fast food'],
    description: 'Char-grilled patties, house berbere mayo, fries cut in the back.',
    emoji: '🍔',
    tint: '#a8620a',
    phone: '0911000002',
    address: 'Bole, near Skylight',
    lat: 9.0126,
    lng: 38.7641,
    basePrepMinutes: 14,
    menu: [
      {
        name: 'Burgers',
        items: [
          { name: 'Berbere beef burger', description: 'Double patty, berbere mayo, chipped lettuce', priceCents: 42000, prepMinutes: 12, emoji: '🍔' },
          { name: 'Chicken fillet burger', description: 'Buttermilk brined, house slaw', priceCents: 38000, prepMinutes: 12, emoji: '🐔' },
          { name: 'Fasting bean burger', description: 'Fava bean patty, awaze aioli', priceCents: 34000, prepMinutes: 10, emoji: '🌱' }
        ]
      },
      {
        name: 'Sides',
        items: [
          { name: 'Fries with awaze', description: 'Hand-cut, served with chilli dip', priceCents: 18000, prepMinutes: 6, emoji: '🍟' },
          { name: 'Cheese fries', description: 'Melted cheese, parsley, awaze', priceCents: 24000, prepMinutes: 8, emoji: '🧀' }
        ]
      }
    ]
  },
  {
    name: 'Shireen Piassa',
    cuisine: ['Pizza', 'Italian'],
    description: 'Wood-fired, 24-hour dough, cut by the slice until eight.',
    emoji: '🍕',
    tint: '#0f7b3f',
    phone: '0911000003',
    address: 'Piassa, Africa Ave',
    lat: 9.0361,
    lng: 38.7498,
    basePrepMinutes: 16,
    menu: [
      {
        name: 'Wood-fired pizzas',
        items: [
          { name: 'Kitfo pizza', description: 'Niter kibbeh base, kitfo, awaze, gorgonzola', priceCents: 68000, prepMinutes: 16, emoji: '🍕' },
          { name: 'Margherita', description: 'San Marzano, basil, fior di latte', priceCents: 52000, prepMinutes: 14, emoji: '🍅' },
          { name: 'Fasting veggie', description: 'No cheese — aubergine, pepper, olive, lemon', priceCents: 47000, prepMinutes: 14, emoji: '🫑' }
        ]
      },
      {
        name: 'Pasta',
        items: [
          { name: 'Penne arrabbiata', description: 'Chilli, garlic, tomato, no meat', priceCents: 41000, prepMinutes: 12, emoji: '🍝' }
        ]
      }
    ]
  }
];

async function reset() {
  await Promise.all([
    User.deleteMany({}),
    Restaurant.deleteMany({}),
    Courier.deleteMany({}),
    Order.deleteMany({}),
    Payment.deleteMany({}),
    Rating.deleteMany({})
  ]);
}

async function createUser({ phone, name, role }, address) {
  const user = new User({ phone, name, role, addresses: address ? [{ ...address, contactPhone: phone }] : [] });
  user.setPassword('gebeta123');
  await user.save();
  return user;
}

function itemAt(restaurant, name) {
  for (const section of restaurant.menu) {
    const item = section.items.find((i) => i.name === name);
    if (item) return item._id;
  }
  throw new Error(`Seed references unknown menu item: ${name}`);
}

async function seedCompletedHistory({ customer, restaurant, courier, lines, daysAgo, prepMinutes, stars }) {
  const placed = new Date(Date.now() - daysAgo * 864e5);
  const order = await createOrder({
    customer,
    restaurantId: restaurant._id,
    lines,
    deliveryAddress: { label: 'Home', line: customer.addresses[0].line, city: 'Addis Ababa', lat: customer.addresses[0].lat, lng: customer.addresses[0].lng },
    contactPhone: customer.phone
  });
  const intent = await paymentService.createIntent(order._id, customer);
  await paymentService.confirmMock(intent.paymentId, customer);
  await transition(order._id, { to: STATUS.PREPARING, actor: ACTOR.RESTAURANT, actorId: restaurant.ownerId, note: 'Kitchen accepted the order' });
  await transition(order._id, { to: STATUS.ASSIGNED, actor: ACTOR.COURIER, actorId: courier.userId, note: `${courier.name} accepted the job`, meta: { courierId: courier._id } });
  await transition(order._id, { to: STATUS.READY, actor: ACTOR.RESTAURANT, actorId: restaurant.ownerId, note: 'Food is ready for pickup' });
  await transition(order._id, { to: STATUS.PICKED_UP, actor: ACTOR.COURIER, actorId: courier.userId, note: 'Collected from the restaurant' });
  await transition(order._id, { to: STATUS.DELIVERED, actor: ACTOR.COURIER, actorId: courier.userId, note: 'Handed to the customer' });
  await transition(order._id, { to: STATUS.COMPLETED, actor: ACTOR.CUSTOMER, actorId: customer._id, note: 'Customer rated the order' });

  const accepted = new Date(placed.getTime() + 3 * 60000);
  const ready = new Date(accepted.getTime() + prepMinutes * 60000);
  await Order.updateOne(
    { _id: order._id },
    {
      $set: {
        placedAt: placed,
        paidAt: new Date(placed.getTime() + 60000),
        acceptedAt: accepted,
        readyAt: ready,
        assignedAt: new Date(accepted.getTime() + 4 * 60000),
        pickedUpAt: new Date(ready.getTime() + 5 * 60000),
        deliveredAt: new Date(ready.getTime() + 22 * 60000),
        completedAt: new Date(ready.getTime() + 30 * 60000),
        closedAt: new Date(ready.getTime() + 30 * 60000)
      }
    }
  );
  await Rating.create({ orderId: order._id, customerId: customer._id, targetType: 'restaurant', targetId: restaurant._id, stars, comment: '' });
  await Rating.create({ orderId: order._id, customerId: customer._id, targetType: 'courier', targetId: courier._id, stars: Math.min(5, stars + 1), comment: '' });
  return order;
}

async function main() {
  await connectDb();
  const shouldReset = process.argv.includes('--reset') || (await User.countDocuments()) === 0;
  if (shouldReset) {
    await reset();
    console.log('• cleared collections');
  }

  const admin = await createUser(ACCOUNTS.admin);
  console.log(`• admin ${admin.phone} / gebeta123`);

  const customers = [];
  for (const account of ACCOUNTS.customers) customers.push(await createUser(account, account.address));
  console.log(`• ${customers.length} customers (password gebeta123)`);

  const couriers = [];
  for (const account of ACCOUNTS.couriers) {
    const user = await createUser(account);
    const courier = await Courier.create({
      userId: user._id,
      name: user.name,
      phone: user.phone,
      vehicle: account.vehicle,
      isOnline: true,
      lastKnownLocation: { type: 'Point', coordinates: [account.lng, account.lat] },
      locationUpdatedAt: new Date()
    });
    couriers.push(courier);
  }
  console.log(`• ${couriers.length} couriers online`);

  const restaurants = [];
  for (const [index, spec] of RESTAURANTS.entries()) {
    const owner = await createUser(ACCOUNTS.owners.find((o) => o.restaurant === index));
    const { lat, lng, menu, ...rest } = spec;
    const restaurant = await Restaurant.create({
      ...rest,
      ownerId: owner._id,
      location: { type: 'Point', coordinates: [lng, lat] },
      menu: menu.map((section) => ({ name: section.name, items: section.items }))
    });
    restaurants.push(restaurant);
    console.log(`• ${restaurant.name} — owner ${owner.phone}, ${restaurant.menu.reduce((n, s) => n + s.items.length, 0)} items`);
  }

  // History first: the rolling prep average and ratings need real completed rows.
  const history = [
    { customer: customers[0], restaurant: restaurants[0], courier: couriers[0], daysAgo: 5, prepMinutes: 21, stars: 5, lines: [{ menuItemId: itemAt(restaurants[0], 'Gebeta combination'), qty: 1 }, { menuItemId: itemAt(restaurants[0], 'Spris'), qty: 2 }] },
    { customer: customers[1], restaurant: restaurants[0], courier: couriers[1], daysAgo: 4, prepMinutes: 26, stars: 4, lines: [{ menuItemId: itemAt(restaurants[0], 'Doro wat'), qty: 2 }] },
    { customer: customers[2], restaurant: restaurants[0], courier: couriers[0], daysAgo: 3, prepMinutes: 19, stars: 5, lines: [{ menuItemId: itemAt(restaurants[0], 'Shiro wat'), qty: 1 }, { menuItemId: itemAt(restaurants[0], 'Beyaynetu'), qty: 1 }] },
    { customer: customers[1], restaurant: restaurants[1], courier: couriers[2], daysAgo: 3, prepMinutes: 11, stars: 4, lines: [{ menuItemId: itemAt(restaurants[1], 'Berbere beef burger'), qty: 2 }, { menuItemId: itemAt(restaurants[1], 'Fries with awaze'), qty: 1 }] },
    { customer: customers[0], restaurant: restaurants[1], courier: couriers[0], daysAgo: 2, prepMinutes: 15, stars: 3, lines: [{ menuItemId: itemAt(restaurants[1], 'Chicken fillet burger'), qty: 1 }] },
    { customer: customers[2], restaurant: restaurants[2], courier: couriers[1], daysAgo: 1, prepMinutes: 18, stars: 5, lines: [{ menuItemId: itemAt(restaurants[2], 'Margherita'), qty: 1 }, { menuItemId: itemAt(restaurants[2], 'Penne arrabbiata'), qty: 1 }] }
  ];
  for (const row of history) {
    await seedCompletedHistory({
      customer: row.customer,
      restaurant: row.restaurant,
      courier: row.courier,
      lines: row.lines,
      daysAgo: row.daysAgo,
      prepMinutes: row.prepMinutes,
      stars: row.stars
    });
  }
  console.log(`• ${history.length} completed orders with ratings`);

  for (const restaurant of restaurants) {
    const samples = await Order.find({ restaurantId: restaurant._id, status: STATUS.COMPLETED, readyAt: { $ne: null } }).select('acceptedAt readyAt').lean();
    if (samples.length >= 3) {
      const minutes = samples.map((s) => (new Date(s.readyAt) - new Date(s.acceptedAt)) / 60000);
      restaurant.rollingPrepMinutes = Math.round(minutes.reduce((a, b) => a + b, 0) / minutes.length);
    }
    const agg = await Rating.aggregate([
      { $match: { targetType: 'restaurant', targetId: restaurant._id } },
      { $group: { _id: null, avg: { $avg: '$stars' }, n: { $sum: 1 } } }
    ]);
    if (agg[0]) {
      restaurant.ratingStars = Math.round(agg[0].avg * 10) / 10;
      restaurant.ratingCount = agg[0].n;
    }
    await restaurant.save();
  }
  for (const courier of couriers) {
    const agg = await Rating.aggregate([
      { $match: { targetType: 'courier', targetId: courier._id } },
      { $group: { _id: null, avg: { $avg: '$stars' }, n: { $sum: 1 } } }
    ]);
    const done = await Order.countDocuments({ courierId: courier._id, status: { $in: [STATUS.DELIVERED, STATUS.COMPLETED] } });
    const fees = await Order.aggregate([
      { $match: { courierId: courier._id, status: { $in: [STATUS.DELIVERED, STATUS.COMPLETED] } } },
      { $group: { _id: null, cents: { $sum: '$courierFeeCents' } } }
    ]);
    courier.ratingStars = agg[0] ? Math.round(agg[0].avg * 10) / 10 : 0;
    courier.ratingCount = agg[0]?.n || 0;
    courier.completedDeliveries = done;
    courier.earningsCents = fees[0]?.cents || 0;
    await courier.save();
  }
  console.log('• ratings and rolling prep averages recomputed');

  // One order waiting for payment, one cooking with a courier already assigned.
  const waiting = await createOrder({
    customer: customers[0],
    restaurantId: restaurants[1]._id,
    lines: [{ menuItemId: itemAt(restaurants[1], 'Berbere beef burger'), qty: 2 }, { menuItemId: itemAt(restaurants[1], 'Cheese fries'), qty: 1 }],
    addressId: customers[0].addresses[0]._id
  });
  const intent = await paymentService.createIntent(waiting._id, customers[0]);

  const cooking = await createOrder({
    customer: customers[1],
    restaurantId: restaurants[0]._id,
    lines: [{ menuItemId: itemAt(restaurants[0], 'Gebeta combination'), qty: 1 }, { menuItemId: itemAt(restaurants[0], 'Buna (coffee ceremony)'), qty: 1 }],
    addressId: customers[1].addresses[0]._id
  });
  const cookingIntent = await paymentService.createIntent(cooking._id, customers[1]);
  await paymentService.confirmMock(cookingIntent.paymentId, customers[1]);
  await transition(cooking._id, { to: STATUS.PREPARING, actor: ACTOR.RESTAURANT, actorId: restaurants[0].ownerId, note: 'Kitchen accepted the order' });
  const offered = await assignment.openAssignment(cooking._id);

  console.log(`• order ${waiting._id} is PLACED awaiting payment (${intent.gateway})`);
  console.log(`• order ${cooking._id} is PREPARING, assignment: ${offered.ok ? `offered to ${offered.courierId}` : offered.error}`);

  const summary = {
    api: `http://localhost:${env.port}`,
    gateway: env.gateway,
    accounts: {
      admin: { phone: ACCOUNTS.admin.phone, password: 'gebeta123' },
      restaurantOwner: { phone: ACCOUNTS.owners[0].phone, password: 'gebeta123', restaurant: RESTAURANTS[0].name },
      customer: { phone: ACCOUNTS.customers[0].phone, password: 'gebeta123' },
      couriers: ACCOUNTS.couriers.map((c) => ({ phone: c.phone, password: 'gebeta123' }))
    }
  };
  await mongoose.connection.db.collection('seeds').replaceOne(
    { _id: 'latest' },
    { _id: 'latest', at: new Date(), summary },
    { upsert: true }
  );
  console.log('\n' + JSON.stringify(summary, null, 2));
  await disconnectDb();
}

main().catch(async (err) => {
  console.error('[seed] failed:', err);
  process.exitCode = 1;
  await disconnectDb();
});
