import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext();

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const { user } = useAuth();

  useEffect(() => {
    // Only connect if user is authenticated
    if (!user || !user._id) {
      if (socket) {
        console.log('🔌 Disconnecting socket (no user)');
        socket.close();
        setSocket(null);
        setConnectionStatus('disconnected');
      }
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) {
      console.log('🔌 No token, skipping socket connection');
      return;
    }

    console.log('🔌 Attempting Socket.io connection...');

    // Connect to backend socket server
    // Use relative path to leverage Vite proxy in development
    const socketUrl = import.meta.env.VITE_SOCKET_URL || '';
    const newSocket = io(socketUrl, {
      auth: { token },
      transports: ['polling', 'websocket'],
      reconnection: true,
      reconnectionDelay: 2000,
      reconnectionAttempts: 5,
      timeout: 10000
    });

    newSocket.on('connect', () => {
      console.log('✅ Socket.io connected');
      setConnectionStatus('connected');
      // Join user's personal channel - use _id or id (JWT contains 'id')
      const userId = user._id || user.id;
      if (userId) {
        newSocket.emit('join_profile_channel', userId.toString());
      }
    });

    newSocket.on('disconnect', (reason) => {
      console.log('🔌 Socket disconnected:', reason);
      setConnectionStatus('disconnected');
    });

    newSocket.on('connect_error', (error) => {
      // Only log meaningful errors
      if (error.message && !error.message.includes('websocket error')) {
        console.log('⚠️  Socket connection issue (retrying...):', error.message);
      }
      setConnectionStatus('error');
    });

    newSocket.on('reconnect', (attemptNumber) => {
      console.log('✅ Socket.io reconnected after', attemptNumber, 'attempts');
      setConnectionStatus('connected');
    });

    newSocket.on('reconnect_failed', () => {
      console.error('❌ Socket.io failed to reconnect');
      setConnectionStatus('failed');
    });

    setSocket(newSocket);

    return () => {
      console.log('🔌 Cleaning up socket connection');
      newSocket.close();
    };
  }, [user?._id]); // Only reconnect when user ID changes

  return (
    <SocketContext.Provider value={socket}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);
