# 🍽️ Gebeta Food Delivery

A full-stack cross-platform food delivery application built with **React Native**, **Node.js**, **WebSockets**, and **MongoDB**.

## 📱 Features

- **Customer App** – Browse restaurants, place orders, real-time order tracking
- **Driver App** – Accept/reject orders, live location sharing via GPS
- **Admin Dashboard** – Manage restaurants, menus, orders, and users
- **Real-time Updates** – WebSocket-powered live driver location and order status
- **Payment Gateway** – Integrated payment processing (Stripe-ready)
- **Push Notifications** – Order updates via FCM
- **JWT Authentication** – Secure login for customers, drivers, and admins

## 🏗️ Project Structure

```
gebeta-food-delivery/
├── backend/           # Node.js + Express + WebSocket server
│   ├── src/
│   │   ├── controllers/
│   │   ├── models/
│   │   ├── routes/
│   │   ├── middleware/
│   │   ├── socket/
│   │   └── utils/
│   └── package.json
├── mobile/            # React Native (Expo) app
│   ├── src/
│   │   ├── screens/
│   │   ├── components/
│   │   ├── navigation/
│   │   ├── store/
│   │   ├── hooks/
│   │   └── services/
│   └── package.json
└── docker-compose.yml
```

## 🚀 Getting Started

### Prerequisites

- Node.js >= 18
- MongoDB (local or Atlas)
- Expo CLI (`npm install -g expo-cli`)
- Docker (optional)

### Backend Setup

```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

### Mobile Setup

```bash
cd mobile
npm install
npx expo start
```

### Docker (Full Stack)

```bash
docker-compose up --build
```

## 🛠️ Tech Stack

| Layer        | Technology                          |
|--------------|-------------------------------------|
| Mobile       | React Native (Expo), Redux Toolkit  |
| Backend      | Node.js, Express.js                 |
| Real-time    | Socket.IO (WebSockets)              |
| Database     | MongoDB + Mongoose                  |
| Auth         | JWT + bcrypt                        |
| Maps         | React Native Maps + Google Maps API |
| Payments     | Stripe                              |
| Notifications| Firebase Cloud Messaging            |

## 📡 WebSocket Events

| Event                  | Direction        | Description                        |
|------------------------|------------------|------------------------------------|
| `driver:location`      | Driver → Server  | Driver GPS coordinates update      |
| `order:location_update`| Server → Customer| Broadcast driver location to customer |
| `order:status_change`  | Server → All     | Order status changed notification  |
| `driver:available`     | Driver → Server  | Driver marks themselves available  |
| `order:new`            | Server → Drivers | New order available for pickup     |

## 🔐 API Endpoints

### Auth
- `POST /api/auth/register` – Register user
- `POST /api/auth/login` – Login
- `POST /api/auth/refresh` – Refresh token

### Restaurants
- `GET /api/restaurants` – List restaurants
- `GET /api/restaurants/:id` – Restaurant details + menu
- `POST /api/restaurants` – Create restaurant (admin)

### Orders
- `POST /api/orders` – Place order
- `GET /api/orders/:id` – Order details
- `PATCH /api/orders/:id/status` – Update order status

### Users
- `GET /api/users/profile` – Get profile
- `PATCH /api/users/profile` – Update profile

## 📄 License

MIT
