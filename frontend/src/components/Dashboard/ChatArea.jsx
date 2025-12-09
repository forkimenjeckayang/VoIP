import { useState, useEffect, useRef } from 'react';
import { FiSend, FiPhone, FiPaperclip, FiArrowLeft, FiInfo, FiX, FiMail, FiAlertCircle, FiUserPlus, FiEdit } from 'react-icons/fi';
import api from '../../services/api';
import { useSocket } from '../../context/SocketContext';
import { useAuth } from '../../context/AuthContext';
import { useVoice } from '../../context/VoiceContext';
import './ChatArea.css';
import '../shared/Modal.css';

function ChatArea({ selectedChat, onBack }) {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [contactDetails, setContactDetails] = useState(null);
  const [showContactInfo, setShowContactInfo] = useState(false);
  const [showAddContactModal, setShowAddContactModal] = useState(false);
  const [newContactName, setNewContactName] = useState({ firstName: '', lastName: '' });
  const [showEditContactModal, setShowEditContactModal] = useState(false);
  const [editFormData, setEditFormData] = useState({ firstName: '', lastName: '' });
  const [error, setError] = useState('');
  const messagesEndRef = useRef(null);
  const socket = useSocket();
  const { user } = useAuth();
  const { selectedProfile } = useVoice();

  useEffect(() => {
    if (selectedChat) {
      loadMessages();
      if (selectedChat.phoneNumber) {
        fetchContactDetails(selectedChat.phoneNumber);
      }
    }
  }, [selectedChat]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (socket && selectedChat) {
      socket.on('new_message', (message) => {
        if (message.from === selectedChat.phoneNumber || message.to === selectedChat.phoneNumber) {
          setMessages(prev => [...prev, message]);
        }
      });
    }

    return () => {
      if (socket) {
        socket.off('new_message');
      }
    };
  }, [socket, selectedChat]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchContactDetails = async (phone) => {
    setContactDetails(null);
    try {
      // Clean phone number for API lookup
      // Backend expects almost clean number but handles some cases. 
      // Safest is to send what we have, or maybe strip spaces/parens?
      // Based on controller, it strips '+', checks length, adds '+' back.
      // So assuming we send standard format.

      const res = await api.post('/contact/get-one', { number: phone });
      // The backend returns status: 'false' even on success for this specific endpoint (bug in backend?), 
      // but if data is present, it's valid.
      if (res.data.data) {
        setContactDetails(res.data.data);
      }
    } catch (error) {
      console.error('Failed to fetch contact details:', error);
    }
  };

  const loadMessages = async () => {
    if (!selectedChat || !selectedChat.phoneNumber || !user) return;

    setLoading(true);
    try {
      const res = await api.post('/setting/message-list', {
        phoneNumber: selectedChat.phoneNumber,
        user: user.id // Pass user ID if needed, though usually implicit in token, but let's be safe
      });

      if (res.data.status === 'true') {
        setMessages(res.data.data || []);
      }
    } catch (error) {
      console.error('Failed to load messages:', error);
      // Don't alert on 400 if it's just a new chat (though backend should handle this)
      // We assume empty list from now on for new chats
    }
    setLoading(false);
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedChat || !selectedChat.phoneNumber) return;

    if (!selectedProfile) {
      setError('No active profile (phone number) selected. Please go to Settings to select one, or create one if none exist.');
      return;
    }

    setSending(true);
    try {
      // Corrected payload structure based on backend requirements
      const payload = {
        user: user.id || user._id, // Ensure we pass the user ID from auth context
        numbers: [selectedChat.phoneNumber], // Backend expects array of strings
        profile: selectedProfile, // Backend accesses ._id from this object
        message: newMessage, // Backend expects 'message', not 'body'
        media: []
      };

      const res = await api.post('/setting/send-sms', payload);

      if (res.data.status === true || res.data.status === 'true') {
        const sentMessage = {
          body: newMessage,
          to: selectedChat.phoneNumber,
          from: 'me',
          timestamp: new Date().toISOString(),
          direction: 'outbound'
        };
        setMessages(prev => [...prev, sentMessage]);
        setNewMessage('');
        setError(''); // Clear any previous errors on successful send
      } else {
        setError(res.data.message || 'Failed to send message');
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      setError(error.response?.data?.message || 'Failed to send message. Please try again.');
    }
    setSending(false);
  };

  const closeError = () => {
    setError('');
  };

  const formatPhoneNumber = (phone) => {
    if (!phone) return '';
    // Strip non-digits to analyze
    const cleaned = phone.replace(/\D/g, '');

    // Check for US format (1 + 10 digits)
    if (cleaned.length === 11 && cleaned.startsWith('1')) {
      return cleaned.replace(/(\d{1})(\d{3})(\d{3})(\d{4})/, '+$1 ($2) $3-$4');
    }
    // Check for US format without country code (10 digits) - assume +1
    if (cleaned.length === 10) {
      return cleaned.replace(/(\d{3})(\d{3})(\d{4})/, '+1 ($1) $2-$3');
    }

    // For international or other formats, return as is (or ensure it starts with +)
    // If it doesn't start with +, add it? 
    // The user said "we send a message with the country code number".
    // Usually + is part of the string.
    return phone;
  };

  const formatMessageTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const handleUpdateContact = async () => {
    if (!editFormData.firstName.trim()) {
      setError('First name is required');
      return;
    }

    try {
      const res = await api.post('/contact/update', {
        contact_id: contactDetails._id,
        first_name: editFormData.firstName,
        last_name: editFormData.lastName,
        email: contactDetails.email,
        user: user.id || user._id
      });

      if (res.data.status === true || res.data.status === 'true') {
        setShowEditContactModal(false);
        setContactDetails({ ...contactDetails, first_name: editFormData.firstName, last_name: editFormData.lastName });
      } else {
        setError(res.data.message || 'Failed to update contact');
      }
    } catch (error) {
      console.error('Failed to update contact:', error);
      setError('Failed to update contact');
    }
  };

  const openEditModal = () => {
    setEditFormData({
      firstName: contactDetails.first_name || '',
      lastName: contactDetails.last_name || ''
    });
    setShowEditContactModal(true);
  };

  const handleAddContact = async () => {
    if (!newContactName.firstName.trim()) {
      setError('First name is required');
      return;
    }

    try {
      const res = await api.post('/contact/create', {
        first_name: newContactName.firstName,
        last_name: newContactName.lastName,
        number: selectedChat.phoneNumber,
        email: '',
        user: user.id || user._id
      });

      if (res.data.status === true || res.data.status === 'true') {
        setShowAddContactModal(false);
        setNewContactName({ firstName: '', lastName: '' });
        fetchContactDetails(selectedChat.phoneNumber);
        // Dispatch custom event to notify Sidebar to reload contacts?
        // Simpler for now: The user sees the name update in Chat header. 
        // Sidebar will update on page reload or we can trigger it in future refactor.
      } else {
        setError(res.data.message || 'Failed to add contact');
      }
    } catch (error) {
      console.error('Failed to add contact:', error);
      setError('Failed to add contact');
    }
  };

  const getContactName = () => {
    if (contactDetails) {
      const name = `${contactDetails.first_name || ''} ${contactDetails.last_name || ''}`.trim();
      return name || selectedChat.name || formatPhoneNumber(selectedChat.phoneNumber);
    }
    return selectedChat.name || formatPhoneNumber(selectedChat.phoneNumber);
  };

  const getContactInitials = () => {
    const name = getContactName();
    if (!name) return '?';
    // If name is phone number, return #
    if (name.startsWith('+') || name.startsWith('(')) return '#';
    return name.charAt(0).toUpperCase();
  };



  if (!selectedChat) {
    return (
      <div className="chat-area-empty">
        <div className="empty-chat-state">
          <FiPhone size={64} />
          <h2>VoIP Suite</h2>
          <p>Select a conversation to start messaging</p>
        </div>
      </div>
    );
  }

  const formatDateLabel = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === now.toDateString()) {
      return 'Today';
    }
    if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    }
    return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="chat-area">
      {/* Header */}
      <div className="chat-header">
        <button className="back-btn" onClick={onBack}>
          <FiArrowLeft />
        </button>

        <div className="header-info">
          <div className="header-avatar">
            {getContactInitials()}
          </div>
          <div>
            <h3>{getContactName()}</h3>
            <span className="header-status">
              {contactDetails ? 'Saved Contact' : 'Unknown Number'}
            </span>
          </div>
        </div>

        <div className="header-actions">
          {!contactDetails && (
            <button
              onClick={() => setShowAddContactModal(true)}
              className="icon-btn"
              title="Add to Contacts"
              style={{ marginRight: '8px' }}
            >
              <FiUserPlus />
            </button>
          )}
          <button onClick={() => setShowContactInfo(true)} className="icon-btn" title="Info">
            <FiInfo />
          </button>
          <button onClick={onBack} className="icon-btn" title="Close Chat">
            <FiX />
          </button>
        </div>
      </div>

      {/* Messages List */}
      <div className="messages-container">
        {loading ? (
          <div className="loading-messages">Loading messages...</div>
        ) : messages.length === 0 ? (
          <div className="no-messages">
            <p>No messages yet.</p>
            <small>Send a message to start the conversation.</small>
          </div>
        ) : (
          messages.map((msg, index) => {
            const isOutbound = msg.direction === 'outbound' || msg.type === 'send';
            const currentMsgDate = new Date(msg.timestamp || msg.created_at);
            const prevMsgDate = index > 0 ? new Date(messages[index - 1].timestamp || messages[index - 1].created_at) : null;

            const showDateSeparator = !prevMsgDate || currentMsgDate.toDateString() !== prevMsgDate.toDateString();

            return (
              <div key={index}>
                {showDateSeparator && (
                  <div className="date-separator">
                    <span>{formatDateLabel(currentMsgDate)}</span>
                  </div>
                )}
                <div className={`message ${isOutbound ? 'outgoing' : 'incoming'}`}>
                  <div className="message-content">
                    <p>{msg.body || msg.message}</p>
                    <span className="message-time">
                      {currentMsgDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <form className="message-input-container" onSubmit={handleSendMessage}>
        <button type="button" className="attach-btn">
          <FiPaperclip />
        </button>
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type a message..."
          disabled={sending}
        />
        <button type="submit" className="send-btn" disabled={!newMessage.trim() || sending}>
          {sending ? <div className="spinner-small"></div> : <FiSend />}
        </button>
      </form>

      {/* Error Toast */}
      {error && (
        <div className="error-toast">
          <FiAlertCircle />
          <span>{error}</span>
          <button onClick={closeError}>
            <FiX />
          </button>
        </div>
      )}

      {/* Contact Info Modal */}
      {showContactInfo && (
        <div className="modal-overlay" onClick={() => setShowContactInfo(false)}>
          <div className="modal-content contact-info-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Contact Info</h3>
              <button onClick={() => setShowContactInfo(false)} className="close-btn">
                <FiX />
              </button>
            </div>
            <div className="contact-details">
              <div className="big-avatar">
                {getContactInitials()}
              </div>
              <h2>{getContactName()}</h2>
              <p className="contact-number">{formatPhoneNumber(selectedChat.phoneNumber)}</p>

              {contactDetails && (
                <div className="contact-meta">
                  {contactDetails.email && (
                    <div className="meta-row">
                      <FiMail /> <span>{contactDetails.email}</span>
                    </div>
                  )}
                  <div className="meta-row">
                    <FiInfo /> <span>Added {new Date(contactDetails.created_at).toLocaleDateString()}</span>
                  </div>
                  {contactDetails?.note && (
                    <div className="info-row note-row">
                      <span className="note-label">Note:</span>
                      <p>{contactDetails.note}</p>
                    </div>
                  )}


                  <div style={{ marginTop: '20px', borderTop: '1px solid #333', paddingTop: '15px' }}>
                    <button onClick={openEditModal} className="secondary-btn" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                      <FiEdit /> Edit Contact
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add Contact Modal */}
      {showAddContactModal && (
        <div className="modal-overlay" onClick={() => setShowAddContactModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Add New Contact</h3>
            <div className="form-group">
              <label>First Name</label>
              <input
                type="text"
                value={newContactName.firstName}
                onChange={e => setNewContactName({ ...newContactName, firstName: e.target.value })}
                autoFocus
              />
            </div>
            <div className="form-group">
              <label>Last Name</label>
              <input
                type="text"
                value={newContactName.lastName}
                onChange={e => setNewContactName({ ...newContactName, lastName: e.target.value })}
              />
            </div>
            <p style={{ marginTop: '10px', color: '#888' }}>Phone: {formatPhoneNumber(selectedChat.phoneNumber)}</p>
            <div className="modal-actions">
              <button onClick={() => setShowAddContactModal(false)} className="cancel-btn">Cancel</button>
              <button onClick={handleAddContact} className="confirm-btn">Save Contact</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Contact Modal */}
      {showEditContactModal && (
        <div className="modal-overlay" onClick={() => setShowEditContactModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Edit Contact</h3>
            <div className="form-group">
              <label>First Name</label>
              <input
                type="text"
                value={editFormData.firstName}
                onChange={e => setEditFormData({ ...editFormData, firstName: e.target.value })}
                autoFocus
              />
            </div>
            <div className="form-group">
              <label>Last Name</label>
              <input
                type="text"
                value={editFormData.lastName}
                onChange={e => setEditFormData({ ...editFormData, lastName: e.target.value })}
              />
            </div>
            <div className="modal-actions">
              <button onClick={() => setShowEditContactModal(false)} className="cancel-btn">Cancel</button>
              <button onClick={handleUpdateContact} className="confirm-btn">Update</button>
            </div>
          </div>
        </div>
      )}
      {/* Error Modal */}
      {error && (
        <div className="modal-overlay" onClick={closeError}>
          <div className="modal-content alert-modal error" onClick={(e) => e.stopPropagation()}>
            <div className="icon">
              <FiAlertCircle />
            </div>
            <h3>Error</h3>
            <p>{error}</p>
            <div className="modal-actions">
              <button onClick={closeError} className="confirm-btn">
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ChatArea;
