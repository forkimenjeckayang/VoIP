import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FiMessageSquare, FiUsers, FiSettings, FiLogOut, FiPhone } from 'react-icons/fi';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import './Sidebar.css';

function Sidebar({ conversations, selectedChat, onSelectChat }) {
  const [activeTab, setActiveTab] = useState('chats');
  const [profiles, setProfiles] = useState([]);
  const [selectedProfile, setSelectedProfile] = useState(null);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    loadProfiles();
  }, []);

  const loadProfiles = async () => {
    try {
      const res = await api.post('/profile/getdata');
      if (res.data.status === 'true') {
        setProfiles(res.data.data || []);
        if (res.data.data && res.data.data.length > 0) {
          setSelectedProfile(res.data.data[0]);
        }
      }
    } catch (error) {
      console.error('Failed to load profiles:', error);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const formatPhoneNumber = (phone) => {
    if (!phone) return '';
    return phone.replace(/(\d{1})(\d{3})(\d{3})(\d{4})/, '+$1 ($2) $3-$4');
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;

    if (diff < 86400000) { // Less than 24 hours
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <div className="user-info">
          <div className="user-avatar">
            {user?.email?.charAt(0).toUpperCase()}
          </div>
          <div className="user-details">
            <h3>{user?.email}</h3>
            {selectedProfile && (
              <p className="user-phone">{formatPhoneNumber(selectedProfile.phoneNumber)}</p>
            )}
          </div>
        </div>
        <button onClick={handleLogout} className="logout-btn" title="Logout">
          <FiLogOut />
        </button>
      </div>

      <div className="sidebar-tabs">
        <button
          className={activeTab === 'chats' ? 'active' : ''}
          onClick={() => { setActiveTab('chats'); navigate('/'); }}
        >
          <FiMessageSquare /> Chats
        </button>
        <button
          className={activeTab === 'dialer' ? 'active' : ''}
          onClick={() => { setActiveTab('dialer'); navigate('/dialer'); }}
        >
          <FiPhone /> Dialer
        </button>
        <button
          className={activeTab === 'contacts' ? 'active' : ''}
          onClick={() => { setActiveTab('contacts'); navigate('/contacts'); }}
        >
          <FiUsers /> Contacts
        </button>
        <button
          className={activeTab === 'settings' ? 'active' : ''}
          onClick={() => { setActiveTab('settings'); navigate('/settings'); }}
        >
          <FiSettings /> Settings
        </button>
      </div>

      {activeTab === 'chats' && (
        <div className="conversations-list">
          {conversations.length === 0 ? (
            <div className="empty-state">
              <FiMessageSquare size={48} />
              <p>No conversations yet</p>
              <small>Start messaging from contacts</small>
            </div>
          ) : (
            conversations.map((conv, index) => (
              <div
                key={index}
                className={`conversation-item ${selectedChat?.phoneNumber === conv.phoneNumber ? 'active' : ''}`}
                onClick={() => onSelectChat(conv)}
              >
                <div className="conversation-avatar">
                  <FiPhone />
                </div>
                <div className="conversation-info">
                  <div className="conversation-header">
                    <h4>{formatPhoneNumber(conv.phoneNumber)}</h4>
                    <span className="conversation-time">{formatTime(conv.timestamp)}</span>
                  </div>
                  <div className="conversation-preview">
                    <p>{conv.lastMessage}</p>
                    {conv.unread > 0 && (
                      <span className="unread-badge">{conv.unread}</span>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default Sidebar;
