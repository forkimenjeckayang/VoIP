# VoIP Suite - Modern Frontend

A modern WhatsApp-inspired web application for managing VoIP communications, built with React, Vite, and Socket.io.

## 🎨 Features

- **WhatsApp-like UI**: Clean, modern interface inspired by WhatsApp Web
- **Real-time Messaging**: SMS/MMS with live updates via Socket.io
- **Contact Management**: Add, edit, and organize your contacts
- **Profile Management**: Manage multiple phone numbers
- **Voice Calling**: Integrated Twilio voice calling (ready for implementation)
- **Responsive Design**: Works on desktop and mobile devices
- **Dark Theme**: Easy on the eyes with a professional dark theme

## 🚀 Getting Started

### Prerequisites

- Node.js v16+
- Backend server running on port 3001

### Installation

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Open your browser to `http://localhost:5173`

### Building for Production

```bash
npm run build
```

The built files will be in the `dist` directory.

## 📁 Project Structure

```
frontend/
├── src/
│   ├── components/
│   │   ├── Auth/           # Login & Register
│   │   └── Dashboard/      # Main app components
│   │       ├── Dashboard.jsx
│   │       ├── Sidebar.jsx
│   │       ├── ChatArea.jsx
│   │       ├── Contacts.jsx
│   │       └── Settings.jsx
│   ├── context/
│   │   ├── AuthContext.jsx    # Authentication state
│   │   └── SocketContext.jsx  # Real-time socket connection
│   ├── services/
│   │   └── api.js             # Axios API client
│   ├── App.jsx
│   ├── main.jsx
│   └── index.css
└── package.json
```

## 🔌 API Integration

The frontend connects to the backend API running on `http://localhost:3001`. All API calls are proxied through Vite's dev server.

### Key Endpoints Used:

- **Authentication**: `/api/auth/login`, `/api/auth/register`
- **Messaging**: `/api/setting/send-sms`, `/api/setting/message-list`
- **Contacts**: `/api/contact/get-all`, `/api/contact/create`
- **Profiles**: `/api/profile/getdata`, `/api/setting/create`
- **Balance**: `/api/setting/get-balance`

## 🎨 Customization

### Theme Colors

Edit `src/index.css` to customize the color scheme:

```css
:root {
  --primary-color: #00a884;      /* Main brand color */
  --bg-primary: #111b21;         /* Main background */
  --bg-secondary: #202c33;       /* Secondary background */
  --text-primary: #e9edef;       /* Primary text */
  --text-secondary: #8696a0;     /* Secondary text */
}
```

## 🔐 Authentication

The app uses JWT tokens stored in localStorage. The token is automatically included in all API requests via an Axios interceptor.

## 📡 Real-time Updates

Socket.io is used for real-time message delivery. The connection is established when a user logs in and automatically joins their personal channel.

## 🛠 Technologies

- **React 19** - UI framework
- **Vite** - Build tool and dev server
- **React Router** - Client-side routing
- **Axios** - HTTP client
- **Socket.io Client** - Real-time communication
- **React Icons** - Icon library

## 📱 Mobile Support

The app is fully responsive and works on mobile devices. The sidebar collapses on smaller screens for better mobile experience.

## 🐛 Troubleshooting

### Backend Connection Issues

If you can't connect to the backend:
1. Ensure the backend is running on port 3001
2. Check the proxy configuration in `vite.config.js`
3. Verify CORS settings in the backend allow `http://localhost:5173`

### Socket.io Connection Issues

If real-time updates aren't working:
1. Check the Socket.io server URL in `src/context/SocketContext.jsx`
2. Ensure the backend Socket.io server is running
3. Check browser console for connection errors

## 📄 License

Same as the main project.
