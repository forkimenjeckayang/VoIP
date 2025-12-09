# Starting the Frontend

## Prerequisites
- Node 20+ (use nvm to switch versions)
- Backend running on port 3001

## Commands

### Switch to Node 20 (if not already)
```bash
nvm use 20
```

### Start the frontend dev server
```bash
cd frontend
npm run dev
```

The frontend will start on **http://localhost:5173**

## Running Both Backend & Frontend

### Terminal 1 - Backend (Node 16)
```bash
cd /home/ubuntu/projects/VoIP
nvm use 16
npm run dev
```
Runs on: http://localhost:3001

### Terminal 2 - Frontend (Node 20)
```bash
cd /home/ubuntu/projects/VoIP/frontend
nvm use 20
npm run dev
```
Runs on: http://localhost:5173

### Terminal 3 - Ngrok (optional)
```bash
cd /home/ubuntu/projects/VoIP
ngrok http http://localhost:3001 --log=stdout
```

## Access the App
1. Open browser: **http://localhost:5173**
2. You should see the login page
3. Register a new account or login
4. Backend API calls are proxied through Vite

## Troubleshooting
- If port 5173 is busy: Vite will auto-increment to 5174, 5175, etc.
- Check backend is running: `curl http://localhost:3001/api/auth/get-version`
- Check CORS: Make sure `http://localhost:5173` is in backend's CORS array
