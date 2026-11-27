SkillBridge
SkillBridge is a peer-to-peer skill exchange platform where people can connect, share what they know, and learn from one another. Users can discover potential learning partners, send skill-exchange requests, arrange sessions, and communicate through real-time chat.
Project status: In development. The current application includes account authentication, profiles, skill matching, exchange requests, sessions, chat, and notifications. An AI assistant powered by OpenAI is planned as a future feature and is not included in the current implementation yet.

Features

- Authentication — register and log in using a secure token-based flow.
- User profiles — manage a name, bio, skills to teach, and skills to learn.
- Skill discovery and matching — browse users and view skill-based matches.
- Skill exchange requests — send, view, accept, and reject requests.
- Learning sessions — propose, confirm, reschedule, and cancel sessions.
- Real-time messaging — chat with accepted exchange partners using Socket.IO.
- Message management — edit your own messages within five minutes and delete your own messages.
- Notifications — view notifications and mark them as read.
- Push notifications — register Expo push tokens for supported devices.
  Technology Stack
  Area Technology
  Mobile application React Native, Expo SDK 58, Expo Router, TypeScript
  Backend Node.js, Express, TypeScript
  Database MongoDB with Mongoose
  Authentication JSON Web Tokens (JWT)
  Real-time communication Socket.IO
  Mobile secure storage Expo SecureStore
  Push notifications Expo Notifications / Expo Server SDK

Repository Structure
SkillBridge/
├── backend/
│ ├── src/
│ │ ├── config/ # Database connection
│ │ ├── controllers/ # API request handlers
│ │ ├── middleware/ # Authentication middleware
│ │ ├── models/ # Mongoose models
│ │ ├── routes/ # Express API routes
│ │ ├── services/ # Notification services
│ │ ├── server.ts # Express and Socket.IO server
│ │ └── socket.ts # Real-time chat events
│ └── package.json
│
└── mobile/
├── src/
│ ├── app/ # Expo Router screens
│ ├── components/ # Reusable UI components
│ ├── hooks/ # Custom hooks
│ ├── lib/ # API client and shared utilities
│ └── constants/ # App constants and theme
├── assets/
├── app.json
└── package.json
Getting Started
Prerequisites
Install the following before running the project:

- Node.js and npm
- MongoDB Atlas account or another reachable MongoDB instance
- Expo Go on a physical device, or an Android emulator configured for Expo development
- Git

1. Clone the repository
   git clone https://github.com/NazilMathakiya/SkillBridge.git
   cd SkillBridge
2. Configure and run the backend
   Open a terminal in the backend folder:
   cd backend
   npm install
   Create a .env file inside backend/:
   PORT=5000
   MONGODB_URI=your_mongodb_connection_string
   JWT_SECRET=replace_with_a_long_random_secret
   Replace the example values with your own MongoDB connection string and a strong, private JWT secret. Keep this file out of Git; never commit real credentials.

Start the development server:
npm run dev
The backend runs on port 5000 by default. Check the health endpoint in a browser or API client:
http://localhost:5000/api/health
A successful response should indicate that the API is healthy. The backend also connects to MongoDB during startup. 3. Configure and run the mobile app
Open a second terminal from the repository root:
cd mobile
npm install
Create a .env file inside mobile/:
EXPO_PUBLIC_API_URL=http://YOUR_COMPUTER_LAN_IP:5000/api
Replace YOUR_COMPUTER_LAN_IP with the IP address of the computer running the backend. When using a physical phone, the phone and computer must be connected to the same local network. Do not use localhost for the phone's API URL because localhost on the phone refers to the phone itself.

Start Expo:
npx expo start
Scan the QR code with Expo Go, or select an available emulator/device from the Expo CLI.
The mobile API client uses EXPO_PUBLIC_API_URL for HTTP requests and derives the Socket.IO server address from it. Keep the /api suffix in this environment variable.

Available Scripts
Backend (backend/)
Command Description
npm run dev Start the TypeScript backend in watch mode using tsx
npm run build Compile the backend TypeScript using tsc
npm start Run the compiled server from dist/

Mobile (mobile/)
Command Description
npx expo start Start the Expo development server
npm run android Start Expo targeting Android
npm run web Start the web target
npm run lint Run Expo lint checks

API Overview
All API paths below are prefixed with /api. Authenticated endpoints require a bearer token in the Authorization header:
Authorization: Bearer YOUR_JWT_TOKEN
Area Method Endpoint Purpose
Health GET /health Check backend health
Authentication POST /auth/register Register an account
Authentication POST /auth/login Log in
Profile GET /profile/me Get the current user's profile
Profile PUT /profile/me Update the current user's profile
Users GET /users Get users
Users GET /users/matches Get skill-based matches
Exchange requests POST /exchange-requests Send an exchange request
Exchange requests GET /exchange-requests/sent Get sent requests
Exchange requests GET /exchange-requests/received Get received requests
Exchange requests PATCH /exchange-requests/:requestId/respond Accept or reject a request
Sessions GET /sessions Get the user's sessions
Sessions POST /sessions Propose a session
Sessions PATCH /sessions/:sessionId/confirm Confirm a session
Sessions PATCH /sessions/:sessionId/reschedule Reschedule a session
Sessions PATCH /sessions/:sessionId/cancel Cancel a session
Chats GET /chats Get the user's chats
Chats GET /chats/:chatId/messages Get messages for a chat
Notifications GET /notifications Get notifications
Notifications PATCH /notifications/:notificationId/read Mark a notification as read
Notifications PATCH /notifications/read-all Mark all notifications as read
Push tokens POST /push-tokens Register a device push token

Real-time Chat Events
The backend uses Socket.IO for real-time chat. A connected client authenticates with its JWT and joins an authorized chat room before sending or managing messages.
Direction Event Purpose
Client → Server chat:join Join a chat after access validation
Client → Server message:send Send a message
Client → Server message:edit Edit the sender's own message within five minutes
Client → Server message:delete Delete the sender's own message
Server → Client chat:joined Confirm successful room join
Server → Client message:new Deliver a new message
Server → Client message:edited Deliver an edited message to chat participants
Server → Client message:deleted Notify clients that a message was deleted
Server → Client chat:error Report a chat validation or processing error

Security Notes

- Keep backend secrets such as MONGODB_URI and JWT_SECRET in backend/.env.
- Never put private API keys or database credentials in the mobile app.
- Do not commit .env files, access tokens, or private credentials.
- Authenticated API routes use JWT middleware.
- Chat access and message ownership are checked on the server, not only in the mobile UI.
- Message editing is restricted to the original sender and a five-minute window enforced by the backend.
  Roadmap
  Planned improvements may include:
- SkillBridge AI — a general-purpose AI assistant users can chat with for explanations, coding help, and learning support, powered by the OpenAI API.
- AI conversation history and additional learning tools.
- Further improvements to the learning and session experience.
  These items are planned and should not be considered available in the current release until implemented and tested.
  Contributing
  Contributions and suggestions are welcome. For a change:

1. Create a feature branch.
2. Make and test your changes locally.
3. Keep secrets and local environment files out of commits.
4. Open a pull request with a clear description of the change.
   License
   Check the repository's license and applicable third-party dependency licenses before redistributing this project.
