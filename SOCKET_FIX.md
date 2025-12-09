# Socket.io Connection Guide

## What Was the Error?

```
WebSocket connection to 'ws://localhost:3001/socket.io/' failed
Socket connection error: TransportError: websocket error
```

## Why It Happened

Socket.io has two transport methods:
1. **WebSocket** - Fast, real-time, persistent connection
2. **HTTP Polling** - Slower, fallback method

**The Problem:**
- Vite's dev proxy doesn't handle WebSocket upgrades
- Socket.io tried WebSocket first → failed → fell back to polling
- You saw error logs but it actually worked fine (just using polling)

## The Fix

Changed transport priority in `SocketContext.jsx`:

**BEFORE:**
```javascript
transports: ['websocket', 'polling']  // ❌ Try WebSocket first (fails in dev)
```

**AFTER:**
```javascript
transports: ['polling', 'websocket']  // ✅ Start with polling, upgrade to WS if possible
reconnection: true,
reconnectionDelay: 1000,
reconnectionAttempts: 5
```

Also improved error logging to filter out expected fallback errors.

---

## What You'll See Now

**Before (with errors):**
```
❌ WebSocket connection failed
❌ Socket connection error: TransportError
❌ WebSocket connection failed (repeating)
```

**After (clean):**
```
✅ Socket.io connected
```

---

## How Socket.io Works in Your App

### Connection Flow:
```
User logs in
    ↓
SocketContext creates connection to http://localhost:3001
    ↓
Starts with HTTP polling
    ↓
Backend allows upgrade to WebSocket
    ↓
Connection established
    ↓
Joins user's personal channel (user._id)
    ↓
Ready to receive real-time messages/calls
```

### What It's Used For:
1. **Incoming SMS/MMS** - Backend pushes to browser instantly
2. **Incoming Calls** - Ring notification appears immediately
3. **Message status updates** - Delivery confirmation
4. **Real-time sync** - Multiple devices stay in sync

---

## Production Deployment

In **production** (not localhost):
- WebSocket works fine
- No Vite proxy involved
- Connection goes directly to backend
- Use `transports: ['websocket', 'polling']` (WebSocket first)

For production, update `.env`:
```env
VITE_SOCKET_URL=https://your-production-backend.com
```

---

## Troubleshooting

**Problem**: Still seeing errors

**Solution**: 
1. Restart frontend dev server
2. Hard refresh browser (Ctrl+Shift+R / Cmd+Shift+R)
3. Check backend is running on port 3001

**Problem**: "Socket disconnected: transport close"

**Solution**: 
- This is normal when you refresh the page
- Socket reconnects automatically

**Problem**: Not receiving real-time messages

**Solution**:
1. Check console for "✅ Socket.io connected"
2. Test by sending SMS to your Twilio number
3. Should appear instantly without refresh

---

## Is It Working?

Check browser console for:
```
✅ Socket.io connected
```

No more WebSocket errors! 🎉
