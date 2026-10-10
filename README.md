# Gebeta Food Delivery

A working food-delivery marketplace: one Node backend with Socket.IO realtime, and three clients that all talk to it —

| Client | Path | Runs on | Port |
| --- | --- | --- | --- |
| API + realtime | `backend/` | Node 20+, MongoDB | 4000 |
| Gebeta Admin (operator + kitchen console) | `admin/` | Vite React, browser | 5174 |
| Gebeta User (ordering) | `apps/user/` | Expo: Android, iOS, web | 8082 |
| Gebeta Delivery (courier) | `apps/delivery/` | Expo: Android, iOS, web | 8083 |

Everything is Addis Ababa-shaped: ETB currency, integer cents for money, phone-number logins, and a delivery map drawn
from coordinates rather than a tile provider, so no API key is needed to run it.

## Run it

```bash
# 1. dependencies (four package.json files)
npm run install:all

# 2. start MongoDB locally, then configure the API
cd backend && cp .env.example .env      # change JWT_SECRET
cd ..

# 3. seed a full demo marketplace (destructive: it clears the collections)
npm run seed

# 4. the API, in its own terminal
npm run api

# 5. the clients, each in its own terminal
npm run admin
npm run user
npm run delivery
```

`npm run seed` without `--reset` adds to what is already there; `npm run seed` (the root script) resets.

Open the admin at <http://localhost:5174>. The Expo apps open in Expo Go on a phone, or in the browser with
`npm run user:web` / `npm run delivery:web`. Both mobile apps derive the API address from Metro's own `hostUri`, so a
phone on the same Wi-Fi reaches the backend without anyone typing an IP. Override it with `EXPO_PUBLIC_API_URL` if the
API lives elsewhere; the admin reads `VITE_API_URL`.

```bash
npm test        # 31 backend tests: state machine, ETA maths, dispatch, and a full HTTP + Socket.IO lifecycle
```

## Accounts the seed creates

All seeded passwords are `gebeta123`.

| Role | Phone | Used by |
| --- | --- | --- |
| Operator | `0900000001` | Gebeta Admin → Live ops, Kitchens, Couriers, Accounts |
| Kitchen owner | `0911111101` | Gebeta Admin → Kitchen queue (Gebeta Injera House) |
| Kitchen owner | `0911111102`, `0911111103` | Yod Burger Bole, Shireen Piassa |
| Customer | `0922222201` | Gebeta User |
| Courier | `0933333301` | Gebeta Delivery (motorbike, starts online near Bole) |
| Courier | `0933333302`, `0933333303` | Gebeta Delivery |

The seed leaves the marketplace mid-shift: six completed orders (so each kitchen has a real rolling prep average), one
order cooking with a courier on it, and one waiting for payment.

## How the system is put together

**The order state machine lives on the server only.** `backend/src/services/status.js` holds the allowed transitions and
who may request each edge. Every write path calls `assertTransition` before saving and broadcasts after the save, so a
client can never describe a state that was not written, and an illegal move is a `409 ILLEGAL_TRANSITION`. The admin and
both mobile apps render whatever the socket confirms; none of them patches a status locally.

**Rooms are authorisation, not convenience.** A socket joins `order:<id>` only after `mayViewOrder` checks that the
connected user is the buyer, the owning kitchen, the assigned courier, or an operator. The customer's address and phone
number are never put in a shared room: `order:update` carries a sanitised view, and the PII travels in `courier:job`,
which is emitted only to that one courier's personal room, and only while the job is live.

**One event name per audience.** A socket belongs to several rooms at once, so the same transition arriving twice would
have to be de-duplicated on the client. Instead `order:update` goes to the order room, `restaurant:order` to the kitchen
room, `admin:order` to the operator room.

**Dispatch is a widening offer chain, not a broadcast to everyone.** When a kitchen accepts an order, the engine ranks
online couriers by minutes-to-arrival plus a load penalty, offers to the best one with a 30-second timer, records the
attempt, and falls through to the next on decline or expiry. The radius grows with each failure; a watchdog sweeps
orders nobody took. `GET /api/admin/orders` shows the attempt count, so an unassigned order is explainable.

**The ETA is rebuilt from live inputs** — the kitchen's rolling average, how long this order has actually been cooking,
and the courier's last reported position. Past the average it climbs rather than sitting at a floor, and every ETA ships
with the `reason` text the customer sees.

**Payment reaches PAID through one door.** The mock gateway (default) and Stripe both end in `markPaid`, which is only
reachable from the gateway confirmation path. `/api/payments/mock/confirm` returns `410` the moment a live gateway is
configured, so no client can talk an order into paid. Cancelling or declining a settled order marks it refunded whether
or not a courier was ever dispatched.

**Money is integer cents, everywhere.** Fees, the 15% marketplace take, and courier fares are computed server-side; a
cart sends menu ids and quantities and nothing else, so a tampered price cannot reach the order.

## Layout

```
backend/          Express + Socket.IO + Mongoose; src/services holds the domain
  src/routes/     auth · restaurants · orders · payments · courier · restaurant-owner · admin
  src/services/   orderService · status · assignment · eta · geo · payment · serialize · watchdog
  src/realtime/   io.js (auth + rooms) · bus.js (fan-out)
  test/           node:test suites, including a full lifecycle over HTTP and sockets
apps/shared/      one API client, session, cart, status vocabulary, design tokens, UI atoms
apps/user/        Gebeta User — browse, cart, checkout, live tracking
apps/delivery/    Gebeta Delivery — offers, job board, pickup and drop-off confirmations, earnings
admin/            Gebeta Admin — live ops, kitchens, couriers, accounts, and the kitchen queue
```

`apps/shared` is consumed through each Expo app's `metro.config.js` (`watchFolders`), so both apps import the same
files without a build step or a package boundary.

## Going live

- Set `JWT_SECRET`, `NODE_ENV=production`, and a real `MONGODB_URI`. The server refuses to boot in production with the
  development secret.
- Set `CORS_ORIGIN` to your admin origin instead of `*`.
- For Stripe: `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`, then point the webhook at
  `POST /webhooks/stripe` (the raw body is verified before the JSON parser touches it).
- For a hosted API, set `EXPO_PUBLIC_API_URL` in each app and `VITE_API_URL` for the admin.
- The courier app asks for foreground location on first sign-in. Pickup and delivery confirmations are refused unless
  the last reported position is within 400 m and 300 m of the door respectively; those tolerances are
  `PICKUP_TOLERANCE_M` and `DROPOFF_TOLERANCE_M`.
