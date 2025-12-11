import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FiMessageSquare, FiUsers, FiSettings, FiLogOut, FiPhone, FiEdit, FiX, FiClock } from 'react-icons/fi';
import { useAuth } from '../../context/AuthContext';
import { useVoice } from '../../context/VoiceContext';
import api from '../../services/api';
import './Sidebar.css';
import '../shared/Modal.css';

function Sidebar({ conversations, selectedChat, onSelectChat, onReloadContacts }) {
  const [activeTab, setActiveTab] = useState('chats');
  const [showNewMessageModal, setShowNewMessageModal] = useState(false);
  const [contacts, setContacts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const { user, logout } = useAuth();

  const { selectedProfile } = useVoice();
  const navigate = useNavigate();
  const location = useLocation();

  const loadContacts = useCallback(async () => {
    try {
      const res = await api.get('/contact/get-all');
      if (res.data.status) {
        setContacts(res.data.data || []);
      }
    } catch (error) {
      console.error('Failed to load contacts:', error);
    }
  }, []);

  useEffect(() => {
    loadContacts();
    // Expose reload function to parent if provided
    if (onReloadContacts) {
      onReloadContacts.current = loadContacts;
    }
  }, [loadContacts, onReloadContacts]);

  const handleSelectContact = (contact) => {
    // Create a conversation object and select it
    let chatData;

    if (contact.isRaw) {
      // User entered a raw number
      chatData = {
        phoneNumber: contact.number,
        name: contact.number, // No name known yet
        lastMessage: '',
        timestamp: new Date().toISOString()
      };
    } else {
      // User selected a known contact
      chatData = {
        phoneNumber: contact.number,
        name: `${contact.first_name} ${contact.last_name}`,
        lastMessage: '',
        timestamp: new Date().toISOString()
      };
    }

    onSelectChat(chatData);
    setShowNewMessageModal(false);
    setSearchTerm(''); // Reset search
    navigate('/');
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const formatPhoneNumber = (phone) => {
    if (!phone) return '';
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 11 && cleaned.startsWith('1')) {
      return cleaned.replace(/(\d{1})(\d{3})(\d{3})(\d{4})/, '+$1 ($2) $3-$4');
    }
    return phone;
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

  const getInitials = (contact) => {
    const first = contact.first_name?.charAt(0) || '';
    const last = contact.last_name?.charAt(0) || '';
    return (first + last).toUpperCase() || '?';
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
          className={activeTab === 'call-history' ? 'active' : ''}
          onClick={() => { setActiveTab('call-history'); navigate('/call-history'); }}
        >
          <FiClock /> Call History
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
        <>
          <div className="conversations-header">
            <h3>Messages</h3>
            <button onClick={() => setShowNewMessageModal(true)} className="new-message-btn" title="New Message">
              <FiEdit /> New
            </button>
          </div>
          <div className="conversations-list">
            {conversations.length === 0 ? (
              <div className="empty-state">
                <FiMessageSquare size={48} />
                <p>No conversations yet</p>
                <small>Click "New" to start messaging</small>
              </div>
            ) : (
              conversations.map((conv, index) => {
                // Try to resolve contact name from local contacts list
                // This covers cases where the message record itself isn't linked to the contact yet
                const contact = contacts.find(c => c.number === conv.phoneNumber);
                const displayName = contact
                  ? `${contact.first_name} ${contact.last_name}`
                  : (conv.name || formatPhoneNumber(conv.phoneNumber));

                return (
                  <div
                    key={index}
                    className={`conversation-item ${selectedChat?.phoneNumber === conv.phoneNumber ? 'active' : ''}`}
                    onClick={() => onSelectChat({ ...conv, name: displayName })}
                  >
                    <div className="conversation-avatar">
                      {contact ? getInitials(contact) : (displayName ? displayName[0].toUpperCase() : <FiPhone />)}
                    </div>
                    <div className="conversation-info">
                      <div className="conversation-header">
                        <h4>{displayName}</h4>
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
                );
              })
            )}
          </div>
        </>
      )}

      {/* New Message Modal */}
      {showNewMessageModal && (
        <div className="modal-overlay" onClick={() => setShowNewMessageModal(false)}>
          <div className="modal-content new-message-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-inline">
              <h3>✉️ New Message</h3>
              <button onClick={() => setShowNewMessageModal(false)} className="close-btn-inline">
                <FiX />
              </button>
            </div>

            <div className="search-box-container" style={{ margin: '15px 0' }}>
              <input
                type="text"
                placeholder="Type a name or phone number..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input"
                autoFocus
              />
            </div>

            <div className="contacts-select-list">
              {/* Option to message the raw number typed if it looks like a number */}
              {searchTerm.replace(/\D/g, '').length >= 3 && (
                <div
                  className="contact-select-item"
                  onClick={() => handleSelectContact({ number: searchTerm, isRaw: true })}
                  style={{ borderBottom: '1px dashed #333' }}
                >
                  <div className="contact-avatar-small" style={{ background: '#25D366' }}>
                    <FiPhone />
                  </div>
                  <div className="contact-select-info">
                    <strong>Message Number</strong>
                    <span>{searchTerm}</span>
                  </div>
                </div>
              )}

              {/* Filtered Contacts */}
              {contacts
                .filter(c =>
                  `${c.first_name} ${c.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
                  c.number.includes(searchTerm)
                )
                .map((contact) => (
                  <div
                    key={contact._id}
                    className="contact-select-item"
                    onClick={() => handleSelectContact(contact)}
                  >
                    <div className="contact-avatar-small">
                      {getInitials(contact)}
                    </div>
                    <div className="contact-select-info">
                      <strong>{contact.first_name} {contact.last_name}</strong>
                      <span>{formatPhoneNumber(contact.number)}</span>
                    </div>
                  </div>
                ))}

              {contacts.length === 0 && !searchTerm && (
                <div className="empty-state-mini">
                  <p>No contacts saved.</p>
                  <small>Type a number above to start chatting.</small>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Sidebar;
