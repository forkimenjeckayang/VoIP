import { useState, useEffect, useRef } from 'react';
import { FiSend, FiPhone, FiPaperclip, FiArrowLeft, FiInfo, FiX, FiMail, FiAlertCircle, FiUserPlus, FiEdit, FiTrash2, FiMoreVertical } from 'react-icons/fi';
import api from '../../services/api';
import { useSocket } from '../../context/SocketContext';
import { useAuth } from '../../context/AuthContext';
import { useVoice } from '../../context/VoiceContext';
import './ChatArea.css';
import '../shared/Modal.css';

function ChatArea({ selectedChat, onBack, onContactSaved }) {
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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showDeleteChatConfirm, setShowDeleteChatConfirm] = useState(false);
  const [messageToDelete, setMessageToDelete] = useState(null);
  const [hoveredMessageId, setHoveredMessageId] = useState(null);
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

  // Listen for contact deletion events to refresh contact details
  useEffect(() => {
    const handleContactDeletedEvent = (event) => {
      // If the deleted contact is the currently selected chat, refresh contact details
      if (selectedChat && event.detail?.phoneNumber === selectedChat.phoneNumber) {
        // Clear contact details to show as unsaved
        setContactDetails(null);
      }
    };

    window.addEventListener('contactDeleted', handleContactDeletedEvent);
    return () => {
      window.removeEventListener('contactDeleted', handleContactDeletedEvent);
    };
  }, [selectedChat]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (socket && selectedChat) {
      const handleNewMessage = (message) => {
        console.log('📨 Received new_message socket event:', message);
        // Check if message is for this chat (compare with contact's phone number)
        // Message.number is the contact's number, message.twilio_number is our number
        const isForThisChat = 
          message.number === selectedChat.phoneNumber || 
          message.twilio_number === selectedChat.phoneNumber ||
          message.from === selectedChat.phoneNumber || 
          message.to === selectedChat.phoneNumber;
        
        if (isForThisChat) {
          // Check if message already exists (prevent duplicates)
          setMessages(prev => {
            const exists = prev.some(msg => 
              msg._id === message._id || 
              (msg.message === message.message && 
               msg.created_at === message.created_at)
            );
            if (exists) {
              console.log('⚠️ Duplicate message detected, skipping');
              return prev;
            }
            console.log('✅ Adding new message to chat');
            return [...prev, message];
          });
        }
      };

      const handleMessagesDeleted = (data) => {
        console.log('🗑️ Received messages_deleted socket event:', data);
        if (data.number === selectedChat.phoneNumber) {
          // Reload messages if current chat was deleted
          loadMessages();
        }
      };

      const handleMessageDeleted = (data) => {
        console.log('🗑️ Received message_deleted socket event:', data);
        if (data.number === selectedChat.phoneNumber) {
          // Remove the deleted message from the list
          setMessages(prev => prev.filter(msg => msg._id !== data.message_id));
        }
      };

      socket.on('new_message', handleNewMessage);
      socket.on('messages_deleted', handleMessagesDeleted);
      socket.on('message_deleted', handleMessageDeleted);

      return () => {
        if (socket) {
          socket.off('new_message', handleNewMessage);
          socket.off('messages_deleted', handleMessagesDeleted);
          socket.off('message_deleted', handleMessageDeleted);
        }
      };
    }
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
        user: user.id || user._id // Pass user ID if needed, though usually implicit in token, but let's be safe
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
        // Don't add message locally - wait for socket event from backend
        // This ensures consistency and prevents duplicates
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
        // Notify parent to reload conversations and contacts
        if (onContactSaved) {
          onContactSaved();
        }
      } else {
        setError(res.data.message || 'Failed to update contact');
      }
    } catch (error) {
      console.error('Failed to update contact:', error);
      setError('Failed to update contact');
    }
  };

  const handleDeleteContact = async () => {
    if (!contactDetails) return;

    try {
      const res = await api.post('/contact/delete', { contact_id: contactDetails._id });
      if (res.data.status === true || res.data.status === 'true') {
        setShowDeleteConfirm(false);
        setContactDetails(null);
        // Dispatch custom event to notify Dashboard and other components
        window.dispatchEvent(new CustomEvent('contactDeleted', { 
          detail: { phoneNumber: selectedChat.phoneNumber } 
        }));
        // Also notify parent
        if (onContactSaved) {
          onContactSaved();
        }
      } else {
        setError(res.data.message || 'Failed to delete contact');
      }
    } catch (error) {
      console.error('Failed to delete contact:', error);
      setError('Failed to delete contact');
    }
  };

  const handleDeleteMessage = async (messageId) => {
    if (!messageId || !user) return;

    try {
      const res = await api.post('/setting/message-delete', {
        message_id: messageId,
        user: user.id || user._id
      });

      if (res.data.status === true || res.data.status === 'true') {
        // Message will be removed via socket event, but we can also remove it immediately
        setMessages(prev => prev.filter(msg => msg._id !== messageId));
        setMessageToDelete(null);
      } else {
        setError(res.data.errors || 'Failed to delete message');
      }
    } catch (error) {
      console.error('Failed to delete message:', error);
      setError('Failed to delete message');
    }
  };

  const handleDeleteChat = async () => {
    if (!selectedChat || !selectedChat.phoneNumber || !user) return;

    try {
      const res = await api.post('/setting/message-list-delete', {
        user: user.id || user._id,
        number: selectedChat.phoneNumber
      });

      if (res.data.status === true || res.data.status === 'true') {
        setShowDeleteChatConfirm(false);
        // Messages will be cleared via socket event, but we can also clear immediately
        setMessages([]);
        // Notify parent to reload conversations
        if (onContactSaved) {
          onContactSaved();
        }
      } else {
        setError(res.data.errors || 'Failed to delete chat');
      }
    } catch (error) {
      console.error('Failed to delete chat:', error);
      setError('Failed to delete chat');
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
        // Notify parent to reload conversations and contacts
        if (onContactSaved) {
          onContactSaved();
        }
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
          <button 
            onClick={() => setShowDeleteChatConfirm(true)} 
            className="icon-btn" 
            title="Delete Chat"
            style={{ marginRight: '8px', color: '#ff4444' }}
          >
            <FiTrash2 />
          </button>
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
              <div key={msg._id || index}>
                {showDateSeparator && (
                  <div className="date-separator">
                    <span>{formatDateLabel(currentMsgDate)}</span>
                  </div>
                )}
                <div 
                  className={`message ${isOutbound ? 'outgoing' : 'incoming'}`}
                  onMouseEnter={() => setHoveredMessageId(msg._id)}
                  onMouseLeave={() => setHoveredMessageId(null)}
                  style={{ 
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  {!isOutbound && hoveredMessageId === msg._id && (
                    <button
                      onClick={() => setMessageToDelete(msg._id)}
                      className="message-delete-btn"
                      title="Delete message"
                      style={{
                        background: 'transparent',
                        border: 'none',
                        borderRadius: '50%',
                        width: '18px',
                        height: '18px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        color: 'rgba(255, 255, 255, 0.5)',
                        padding: 0,
                        flexShrink: 0,
                        transition: 'color 0.2s'
                      }}
                      onMouseEnter={(e) => e.target.style.color = 'rgba(255, 68, 68, 0.8)'}
                      onMouseLeave={(e) => e.target.style.color = 'rgba(255, 255, 255, 0.5)'}
                    >
                      <FiTrash2 size={14} />
                    </button>
                  )}
                  <div className="message-content">
                    <p>{msg.body || msg.message}</p>
                    <span className="message-time">
                      {currentMsgDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  {isOutbound && hoveredMessageId === msg._id && (
                    <button
                      onClick={() => setMessageToDelete(msg._id)}
                      className="message-delete-btn"
                      title="Delete message"
                      style={{
                        background: 'transparent',
                        border: 'none',
                        borderRadius: '50%',
                        width: '18px',
                        height: '18px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        color: 'rgba(255, 255, 255, 0.5)',
                        padding: 0,
                        flexShrink: 0,
                        transition: 'color 0.2s'
                      }}
                      onMouseEnter={(e) => e.target.style.color = 'rgba(255, 68, 68, 0.8)'}
                      onMouseLeave={(e) => e.target.style.color = 'rgba(255, 255, 255, 0.5)'}
                    >
                      <FiTrash2 size={14} />
                    </button>
                  )}
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


                  <div style={{ marginTop: '20px', borderTop: '1px solid #333', paddingTop: '15px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <button onClick={openEditModal} className="secondary-btn" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                      <FiEdit /> Edit Contact
                    </button>
                    <button onClick={() => setShowDeleteConfirm(true)} className="secondary-btn" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: '#ff4444', borderColor: '#ff4444' }}>
                      <FiTrash2 /> Delete Contact
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

      {/* Delete Contact Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="modal-overlay" onClick={() => setShowDeleteConfirm(false)}>
          <div className="modal-content alert-modal" onClick={(e) => e.stopPropagation()}>
            <div className="icon error">
              <FiAlertCircle />
            </div>
            <h3>Delete Contact?</h3>
            <p>Are you sure you want to delete <strong>{contactDetails?.first_name} {contactDetails?.last_name}</strong>?</p>
            <p className="warning-text">This action cannot be undone.</p>
            <div className="modal-actions">
              <button onClick={() => setShowDeleteConfirm(false)} className="cancel-btn">
                Cancel
              </button>
              <button onClick={handleDeleteContact} className="delete-confirm-btn" style={{ backgroundColor: '#ff4444' }}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Chat Confirmation Modal */}
      {showDeleteChatConfirm && (
        <div className="modal-overlay" onClick={() => setShowDeleteChatConfirm(false)}>
          <div className="modal-content alert-modal" onClick={(e) => e.stopPropagation()}>
            <div className="icon error">
              <FiAlertCircle />
            </div>
            <h3>Delete Chat?</h3>
            <p>Are you sure you want to delete all messages with <strong>{getContactName()}</strong>?</p>
            <p className="warning-text">This will permanently delete all messages in this conversation. This action cannot be undone.</p>
            <div className="modal-actions">
              <button onClick={() => setShowDeleteChatConfirm(false)} className="cancel-btn">
                Cancel
              </button>
              <button onClick={handleDeleteChat} className="delete-confirm-btn" style={{ backgroundColor: '#ff4444' }}>
                Delete Chat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Message Confirmation Modal */}
      {messageToDelete && (
        <div className="modal-overlay" onClick={() => setMessageToDelete(null)}>
          <div className="modal-content alert-modal" onClick={(e) => e.stopPropagation()}>
            <div className="icon error">
              <FiAlertCircle />
            </div>
            <h3>Delete Message?</h3>
            <p>Are you sure you want to delete this message?</p>
            <p className="warning-text">This action cannot be undone.</p>
            <div className="modal-actions">
              <button onClick={() => setMessageToDelete(null)} className="cancel-btn">
                Cancel
              </button>
              <button onClick={() => handleDeleteMessage(messageToDelete)} className="delete-confirm-btn" style={{ backgroundColor: '#ff4444' }}>
                Delete
              </button>
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
