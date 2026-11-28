# 🚀 SkillBridge — Learn, Teach & Grow Together

SkillBridge is a peer-to-peer skill exchange platform where people can connect, share their knowledge, learn new skills, and grow together.

The idea is simple: **Everyone knows something, and everyone wants to learn something.**

SkillBridge helps users find people with complementary skills, exchange knowledge, communicate in real time, and schedule learning sessions — all through one platform.

---

## ✨ Features

### 👤 User Authentication
- User registration and login.
- Secure password hashing.
- JWT-based authentication.
- Protected API routes.

### 🧑‍💻 User Profiles
- Create and update user profiles.
- Add personal bio.
- Add skills you can teach.
- Add skills you want to learn.

### 🔍 Explore & Skill Matching
- Discover other users.
- Find people based on their skills.
- View matching skills.
- Send skill exchange requests.

### 🔄 Skill Exchange Requests
- Send exchange requests to other users.
- View sent and received requests.
- Accept or reject requests.
- Connect with users for mutual learning.

### 💬 Real-Time Chat
- Chat with accepted exchange partners.
- Send messages instantly using Socket.IO.
- Edit your own messages within 5 minutes.
- Delete your own messages.
- Real-time message updates for both participants.

### 📅 Learning Sessions
- Propose learning sessions.
- Confirm scheduled sessions.
- Reschedule sessions.
- Cancel sessions.

### 🔔 Notifications
- In-app notifications.
- Mark individual notifications as read.
- Mark all notifications as read.
- Push notifications using Expo Notifications.

---

## 🛠️ Tech Stack

### Frontend — Mobile Application
- React Native
- Expo SDK 58
- TypeScript
- Expo Router
- Socket.IO Client
- Expo SecureStore

### Backend
- Node.js
- Express.js
- TypeScript
- MongoDB
- Mongoose
- Socket.IO
- JSON Web Token (JWT)
- bcryptjs

### Other Tools & Services
- MongoDB Atlas
- Git & GitHub
- Expo Notifications

---

## 📁 Project Structure

```text
SkillBridge/
│
├── backend/
│   ├── src/
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── middleware/
│   │   ├── models/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── server.ts
│   │   └── socket.ts
│   │
│   ├── package.json
│   └── tsconfig.json
│
├── mobile/
│   ├── src/
│   │   ├── app/
│   │   │   ├── chat/
│   │   │   ├── index.tsx
│   │   │   ├── explore.tsx
│   │   │   ├── profile.tsx
│   │   │   ├── requests.tsx
│   │   │   └── chats.tsx
│   │   │
│   │   ├── components/
│   │   ├── constants/
│   │   ├── hooks/
│   │   └── lib/
│   │
│   ├── assets/
│   ├── app.json
│   └── package.json
│
└── README.md
