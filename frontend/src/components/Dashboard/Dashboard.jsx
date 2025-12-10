import { useState, useEffect, useRef, useCallback } from 'react';
import { Routes, Route } from 'react-router-dom';
import Sidebar from './Sidebar';
import ChatArea from './ChatArea';
import Contacts from './Contacts';
import Settings from './Settings';
import Dialer from './Dialer';
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

  useEffect(() => {
    // Load conversations even without selectedProfile - messages should still be viewable
    // Only sending requires a profile
    loadConversations();
  }, [selectedProfile]);

  // Listen for profile deletion events
  useEffect(() => {
    if (socket) {
      const handleProfileDeleted = () => {
        // Reload conversations when profile is deleted
        loadConversations();
      };

      socket.on('profile_deleted', handleProfileDeleted);

      return () => {
        if (socket) {
          socket.off('profile_deleted', handleProfileDeleted);
        }
      };
    }
  }, [socket]);

  const loadConversations = async () => {
    try {
      if (!user) return;
      
      // If no profile selected, load all conversations for the user
      if (!selectedProfile) {
        // Load conversations without profile filter - show all messages
        // We'll need to modify the endpoint or use a different approach
        // For now, just return empty if no profile
        setConversations([]);
        return;
      }

      const res = await api.post('/setting/sms-number-list', {
        user: user.id || user._id,
        setting: selectedProfile._id
      });

      // The endpoint returns an array of objects directly (based on controller logic)
      const data = Array.isArray(res.data) ? res.data : [];

      const formattedConversations = data.map(conv => ({
        phoneNumber: conv._id, // Aggregation group _id is the phone number
        name: conv.contact ? `${conv.contact.first_name} ${conv.contact.last_name}` : '',
        lastMessage: conv.message,
        timestamp: conv.created_at || new Date().toISOString(),
        unread: conv.isview || 0 // The controller aggregation sums up 'isview=false' count
      }));

      setConversations(formattedConversations);

    } catch (error) {
      console.error('Failed to load conversations:', error);
    }
  };

  useEffect(() => {
    if (socket) {
      socket.on('new_message', (message) => {
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
              if (!isOutbound) {
                updated[index].unread = (updated[index].unread || 0) + 1;
              }
            } else {
              updated.unshift({
                phoneNumber: otherParty,
                lastMessage: message.body || message.message,
                timestamp: message.timestamp || message.created_at || new Date().toISOString(),
                unread: !isOutbound ? 1 : 0
              });
            }
          }
          return updated;
        });
      });
    }

    return () => {
      if (socket) {
        socket.off('new_message');
      }
    };
  }, [socket]);

  const handleContactSaved = () => {
    // Reload conversations to get updated contact names
    loadConversations();
    // Reload contacts in Sidebar
    if (reloadContactsRef.current) {
      reloadContactsRef.current();
    }
  };

  const handleContactDeleted = useCallback(() => {
    // Reload conversations to remove contact names
    loadConversations();
    // Reload contacts in Sidebar
    if (reloadContactsRef.current) {
      reloadContactsRef.current();
    }
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
    return () => {
      window.removeEventListener('contactDeleted', handleContactDeletedEvent);
    };
  }, [selectedChat, handleContactDeleted]);

  return (
    <div className={`dashboard ${selectedChat || location.pathname !== '/' ? 'mobile-content-active' : ''}`}>
      <Sidebar
        conversations={conversations}
        selectedChat={selectedChat}
        onSelectChat={setSelectedChat}
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
              />
            }
          />
          <Route path="/contacts" element={<Contacts />} />
          <Route path="/dialer" element={<Dialer />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </div>
    </div>
  );
}

export default Dashboard;
