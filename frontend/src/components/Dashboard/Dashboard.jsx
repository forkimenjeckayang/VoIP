import { useState, useEffect, useRef, useCallback } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import ChatArea from './ChatArea';
import Contacts from './Contacts';
import Settings from './Settings';
import Dialer from './Dialer';
import CallHistory from './CallHistory';
import { useSocket } from '../../context/SocketContext';
import { useAuth } from '../../context/AuthContext';
import { useVoice } from '../../context/VoiceContext';
import api from '../../services/api';
import './Dashboard.css';

function Dashboard() {
  const [selectedChat, setSelectedChat] = useState(null);
  const [conversations, setConversations] = useState([]);
  const reloadContactsRef = useRef(null);
  const socket = useSocket();
  const { user } = useAuth();
  const { selectedProfile } = useVoice();
  const location = useLocation();

  const loadConversations = useCallback(async () => {
    try {
      if (!user) {
        console.log('Dashboard: No user, skipping loadConversations');
        return;
      }

      // Always load all conversations for the user, regardless of profile selection
      // Profile is only used for SENDING messages, not for viewing them
      // This matches phone behavior: you can view all messages even without SIM, but need SIM to send
      const requestBody = {
        user: user.id || user._id
      };
      
      // Don't filter by setting - show all messages for the user
      // This ensures messages are visible even when profile changes or is deleted
      console.log('Dashboard: Loading conversations for user (all messages, no profile filter)');

      const res = await api.post('/setting/sms-number-list', requestBody);
      console.log('Dashboard: API response:', res.data);

      // The endpoint returns an array of objects directly (based on controller logic)
      // Check if res.data is an array, or if it's wrapped in a data property
      let data = [];
      if (Array.isArray(res.data)) {
        data = res.data;
      } else if (res.data && Array.isArray(res.data.data)) {
        data = res.data.data;
      } else if (res.data && res.data.status && Array.isArray(res.data.data)) {
        data = res.data.data;
      }

      console.log('Dashboard: Processed conversations data:', data.length, 'conversations');

      const formattedConversations = data.map(conv => ({
        phoneNumber: conv._id, // Aggregation group _id is the phone number
        name: conv.contact ? `${conv.contact.first_name || ''} ${conv.contact.last_name || ''}`.trim() : '',
        lastMessage: conv.message || '',
        timestamp: conv.created_at || new Date().toISOString(),
        unread: 0 // Counter logic removed - no unread badges displayed
      }));

      console.log('Dashboard: Formatted conversations:', formattedConversations.length);
      setConversations(formattedConversations);

    } catch (error) {
      console.error('Failed to load conversations:', error);
      console.error('Error details:', error.response?.data || error.message);
      // Set empty array on error to show "no conversations" state
      setConversations([]);
    }
  }, [user]); // Removed selectedProfile from dependencies - we always load all messages

  useEffect(() => {
    // Load conversations even without selectedProfile - messages should still be viewable
    // Only sending requires a profile
    loadConversations();
  }, [loadConversations]);

  // Listen for profile creation and deletion events
  useEffect(() => {
    if (socket) {
      const handleProfileDeleted = () => {
        console.log('🗑️ Dashboard: Profile deleted, reloading conversations');
        // Reload conversations when profile is deleted
        loadConversations();
      };

      const handleProfileCreated = () => {
        console.log('✅ Dashboard: Profile created, reloading conversations');
        // Reload conversations when profile is created
        loadConversations();
      };

      socket.on('profile_deleted', handleProfileDeleted);
      socket.on('profile_created', handleProfileCreated);

      return () => {
        if (socket) {
          socket.off('profile_deleted', handleProfileDeleted);
          socket.off('profile_created', handleProfileCreated);
        }
      };
    }
  }, [socket, loadConversations]);

  useEffect(() => {
    if (socket) {
      socket.on('new_message', (message) => {
        // Filter out calls - only process actual messages for conversations
        if (message.datatype === 'call') {
          console.log('📞 Ignoring call event in conversation list');
          return;
        }
        
        // Update conversations with new message
        setConversations(prev => {
          const updated = [...prev];
          // Determine the other party's number
          // For outbound: number is the recipient (contact's number)
          // For inbound: number is the sender (contact's number)
          const otherParty = message.number || message.from || message.to;
          const isOutbound = message.direction === 'outbound' || message.type === 'send';

          if (otherParty) {
            const index = updated.findIndex(c => c.phoneNumber === otherParty);
            if (index >= 0) {
              updated[index].lastMessage = message.body || message.message;
              updated[index].timestamp = message.timestamp || message.created_at || new Date().toISOString();
            } else {
              updated.unshift({
                phoneNumber: otherParty,
                lastMessage: message.body || message.message,
                timestamp: message.timestamp || message.created_at || new Date().toISOString(),
                unread: 0
              });
            }
          }
          return updated;
        });
      });

      socket.on('message_deleted', async (data) => {
        console.log('🗑️ Dashboard received message_deleted socket event:', data);
        // When a message is deleted, reload conversations to get the updated last message
        // This ensures the chat list shows the correct last message
        if (data.number) {
          loadConversations();
        }
      });

      socket.on('messages_deleted', async (data) => {
        console.log('🗑️ Dashboard received messages_deleted socket event:', data);
        // When all messages are deleted, remove the conversation or update it
        if (data.number) {
          setConversations(prev => {
            const updated = prev.filter(c => c.phoneNumber !== data.number);
            return updated;
          });
        }
      });
    }

    return () => {
      if (socket) {
        socket.off('new_message');
        socket.off('message_deleted');
        socket.off('messages_deleted');
      }
    };
  }, [socket, loadConversations]);

  const handleContactSaved = () => {
    // Reload conversations to get updated contact names
    loadConversations();
    // Reload contacts in Sidebar
    if (reloadContactsRef.current) {
      reloadContactsRef.current();
    }
  };

  const handleMessageDeleted = useCallback((data) => {
    // When a message is deleted, update the conversations list
    // If it was the last message, reload to get the new last message
    if (data.wasLastMessage && data.phoneNumber) {
      // Reload conversations to get updated last message
      loadConversations();
    } else if (data.phoneNumber) {
      // For non-last messages, we can keep the current lastMessage
      // The socket event will handle the update
      console.log('Message deleted, but not the last message');
    }
  }, [loadConversations]);

  const handleContactDeleted = useCallback(() => {
    // Reload conversations to remove contact names
    loadConversations();
    // Reload contacts in Sidebar
    if (reloadContactsRef.current) {
      reloadContactsRef.current();
    }
  }, [loadConversations]);

  const handleSelectChat = useCallback((chat) => {
    setSelectedChat(chat);
  }, []);

  // Listen for contact deletion events from Contacts component
  useEffect(() => {
    const handleContactDeletedEvent = (event) => {
      handleContactDeleted();
      // If the deleted contact is the currently selected chat, update it
      if (selectedChat && event.detail?.phoneNumber === selectedChat.phoneNumber) {
        // Update selectedChat to remove the name
        setSelectedChat(prev => ({
          ...prev,
          name: prev.phoneNumber // Reset name to phone number
        }));
      }
    };

    window.addEventListener('contactDeleted', handleContactDeletedEvent);
    const handleContactSavedEvent = () => {
      handleContactSaved();
    };

    window.addEventListener('contactSaved', handleContactSavedEvent);
    return () => {
      window.removeEventListener('contactDeleted', handleContactDeletedEvent);
      window.removeEventListener('contactSaved', handleContactSavedEvent);
    };
  }, [selectedChat, handleContactDeleted]);

  return (
    <div className={`dashboard ${selectedChat || location.pathname !== '/' ? 'mobile-content-active' : ''}`}>
      <Sidebar
        conversations={conversations}
        selectedChat={selectedChat}
        onSelectChat={handleSelectChat}
        onReloadContacts={reloadContactsRef}
      />

      <div className="main-content">
        <Routes>
          <Route
            path="/"
            element={
              <ChatArea
                selectedChat={selectedChat}
                onBack={() => setSelectedChat(null)}
                onContactSaved={handleContactSaved}
                onMessageDeleted={handleMessageDeleted}
                onMessagesLoaded={loadConversations}
              />
            }
          />
          <Route path="/contacts" element={<Contacts />} />
          <Route path="/dialer" element={<Dialer />} />
          <Route path="/call-history" element={<CallHistory />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </div>
    </div>
  );
}

export default Dashboard;
