import { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import Sidebar from './Sidebar';
import ChatArea from './ChatArea';
import Contacts from './Contacts';
import Settings from './Settings';
import Dialer from './Dialer';
import { useSocket } from '../../context/SocketContext';
import './Dashboard.css';

function Dashboard() {
  const [selectedChat, setSelectedChat] = useState(null);
  const [conversations, setConversations] = useState([]);
  const socket = useSocket();

  useEffect(() => {
    if (socket) {
      socket.on('new_message', (message) => {
        // Update conversations with new message
        setConversations(prev => {
          const updated = [...prev];
          const index = updated.findIndex(c => c.phoneNumber === message.from);
          if (index >= 0) {
            updated[index].lastMessage = message.body;
            updated[index].timestamp = message.timestamp;
            updated[index].unread = (updated[index].unread || 0) + 1;
          } else {
            updated.unshift({
              phoneNumber: message.from,
              lastMessage: message.body,
              timestamp: message.timestamp,
              unread: 1
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
    <div className="dashboard">
      <Sidebar
        conversations={conversations}
        selectedChat={selectedChat}
        onSelectChat={setSelectedChat}
      />

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
  );
}

export default Dashboard;
