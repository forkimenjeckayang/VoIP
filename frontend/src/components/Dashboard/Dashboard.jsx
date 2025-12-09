import { useState, useEffect } from 'react';
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
  const socket = useSocket();
  const { user } = useAuth();
  const { selectedProfile } = useVoice();

  useEffect(() => {
    if (selectedProfile) {
      loadConversations();
    }
  }, [selectedProfile]);

  const loadConversations = async () => {
    try {
      if (!user || !selectedProfile) return;

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
          const otherParty = message.direction === 'outbound' ? message.to : message.from;

          const index = updated.findIndex(c => c.phoneNumber === otherParty);
          if (index >= 0) {
            updated[index].lastMessage = message.body || message.message;
            updated[index].timestamp = message.timestamp || new Date().toISOString();
            if (message.direction !== 'outbound') {
              updated[index].unread = (updated[index].unread || 0) + 1;
            }
          } else {
            updated.unshift({
              phoneNumber: otherParty,
              lastMessage: message.body || message.message,
              timestamp: message.timestamp || new Date().toISOString(),
              unread: message.direction !== 'outbound' ? 1 : 0
            });
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

  return (
    <div className={`dashboard ${selectedChat || location.pathname !== '/' ? 'mobile-content-active' : ''}`}>
      <Sidebar
        conversations={conversations}
        selectedChat={selectedChat}
        onSelectChat={setSelectedChat}
      />

      <div className="main-content">
        <Routes>
          <Route
            path="/"
            element={
              <ChatArea
                selectedChat={selectedChat}
                onBack={() => setSelectedChat(null)}
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
