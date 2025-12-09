# VoIP Suite - Quick Start Guide

Get your modern VoIP web application up and running in minutes!

## 🚀 Quick Start

### 1. Start the Backend

```bash
# Install backend dependencies (if not already done)
npm install

# Start the backend server
npm run dev
```

The backend will run on `http://localhost:3001`

### 2. Start the Frontend

```bash
# Navigate to frontend directory
cd frontend

# Install frontend dependencies
npm install

# Start the frontend dev server
npm run dev
```

The frontend will run on `http://localhost:5173`

### 3. Access the Application

Open your browser to: `http://localhost:5173`

## 📝 First Time Setup

### 1. Register an Account

- Click "Sign up" on the login page
- Enter your email and password
- Click "Sign Up"

### 2. Login

- Enter your credentials
- Click "Sign In"

### 3. Add a Phone Number

- Go to the **Settings** tab
- Click **"Add Number"**
- Select an available number from your Twilio account
- Enter a profile name
- Click **"Add"**

### 4. Add Contacts

- Go to the **Contacts** tab
- Click **"Add Contact"**
- Enter contact name and phone number
- Click **"Add"**

### 5. Start Messaging

- Go to the **Chats** tab
- Select a contact or conversation
- Type your message and hit send!

## 🎯 Key Features

### Messaging
- Send and receive SMS/MMS
- Real-time message delivery
- Message history
- Media attachments support

### Contacts
- Add, edit, delete contacts
- Search contacts
- Quick access to conversations

### Settings
- View Twilio account balance
- Manage phone numbers
- Add/remove profiles
- Configure settings

### Real-time Updates
- Instant message delivery via Socket.io
- Live conversation updates
- Automatic message sync

## 🔧 Configuration

### Backend Configuration

Edit your `.env` or `development.env`:

```env
# Database
DB='mongodb://localhost:27017/voipsuite'

# Server
PORT=3001
BASE_URL='http://localhost:3001'

# Twilio Credentials
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token

# Security
COOKIE_KEY=random_string_1
COOKIE_KEY2=random_string_2

# Configuration
ALLOWED_COUNTRIES=US,GB
MAX_NUMBERS_PER_USER=5
```

### Frontend Configuration

The frontend automatically connects to `http://localhost:3001` via Vite proxy.

To change the backend URL, edit `frontend/vite.config.js`:

```javascript
server: {
  proxy: {
    '/api': {
      target: 'http://your-backend-url:3001',
      changeOrigin: true,
    }
  }
}
```

## 🐛 Troubleshooting

### Backend won't start
- Check MongoDB is running
- Verify `.env` file exists with correct values
- Check port 3001 is not in use

### Frontend won't start
- Run `npm install` in the frontend directory
- Check port 5173 is not in use
- Clear node_modules and reinstall if needed

### Can't connect to backend
- Ensure backend is running on port 3001
- Check browser console for errors
- Verify CORS settings in backend

### Messages not sending
- Check Twilio credentials are correct
- Verify you have a phone number configured
- Check Twilio account balance
- Look at backend logs for errors

### Real-time updates not working
- Check Socket.io connection in browser console
- Verify backend Socket.io server is running
- Check firewall/network settings

## 📚 Next Steps

1. **Customize the UI**: Edit CSS files to match your brand
2. **Add Voice Calling**: Implement Twilio Voice SDK integration
3. **Deploy to Production**: Build and deploy both backend and frontend
4. **Add Features**: Extend with group messaging, file sharing, etc.

## 🔐 Security Notes

- Always use HTTPS in production
- Keep your Twilio credentials secure
- Use strong passwords
- Enable MFA for production accounts
- Regularly update dependencies

## 📖 Documentation

- **Backend API**: See `swagger.yaml` or visit `http://localhost:3001/` for API docs
- **Frontend**: See `frontend/FRONTEND_README.md`
- **Backend Details**: See `BACKEND_README.md`

## 💡 Tips

- Use the browser's developer tools to debug issues
- Check the Network tab for API call failures
- Monitor the Console for JavaScript errors
- Use the backend logs to troubleshoot server issues

## 🎉 You're Ready!

Your modern VoIP web application is now running. Start messaging and exploring the features!

For questions or issues, check the documentation or review the code comments.
