import { useState, useEffect, useRef } from 'react';
import { FiSend, FiPhone, FiPaperclip, FiArrowLeft, FiInfo, FiX, FiMail, FiAlertCircle, FiUserPlus, FiEdit, FiTrash2, FiMoreVertical, FiDownload } from 'react-icons/fi';
import api from '../../services/api';
import { useSocket } from '../../context/SocketContext';
import { useAuth } from '../../context/AuthContext';
import { useVoice } from '../../context/VoiceContext';
import './ChatArea.css';
import '../shared/Modal.css';

function ChatArea({ selectedChat, onBack, onContactSaved, onMessageDeleted, onMessagesLoaded }) {
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
  const [lightboxImage, setLightboxImage] = useState(null);
  const [selectedMedia, setSelectedMedia] = useState([]);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const fileInputRef = useRef(null);
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
        
        // Filter out calls - only process actual messages
        if (message.datatype === 'call') {
          console.log('📞 Ignoring call event in chat area');
          return;
        }
        
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
        // Filter out any calls that might have been returned (safety check)
        const messagesOnly = (res.data.data || []).filter(msg => 
          !msg.datatype || msg.datatype === 'message'
        );
        setMessages(messagesOnly);
        // Notify parent that messages were loaded (and marked as read)
        // This will refresh the conversations list to update unread counters
        if (onMessagesLoaded) {
          onMessagesLoaded();
        }
      }
    } catch (error) {
      console.error('Failed to load messages:', error);
      // Don't alert on 400 if it's just a new chat (though backend should handle this)
      // We assume empty list from now on for new chats
    }
    setLoading(false);
  };

  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setUploadingMedia(true);
    try {
      const uploadedUrls = [];
      
      for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);
        
        const res = await api.post('/media/upload-files', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });
        
        if (res.data.status && res.data.data) {
          uploadedUrls.push(res.data.data.media);
        }
      }
      
      setSelectedMedia(prev => [...prev, ...uploadedUrls]);
      setError('');
    } catch (error) {
      console.error('Failed to upload media:', error);
      setError(error.response?.data?.message || 'Failed to upload media. Please try again.');
    } finally {
      setUploadingMedia(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const removeMedia = (index) => {
    setSelectedMedia(prev => prev.filter((_, i) => i !== index));
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    // Prevent sending empty messages and media
    const trimmedMessage = newMessage.trim();
    if ((!trimmedMessage && selectedMedia.length === 0) || !selectedChat || !selectedChat.phoneNumber) {
      return;
    }

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
        message: trimmedMessage || '', // Backend expects 'message', not 'body' - use trimmed version
        media: selectedMedia // Include uploaded media URLs
      };

      const res = await api.post('/setting/send-sms', payload);

      if (res.data.status === true || res.data.status === 'true') {
        // Don't add message locally - wait for socket event from backend
        // This ensures consistency and prevents duplicates
        setNewMessage('');
        setSelectedMedia([]); // Clear selected media after sending
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

  // Parse media from message (stored as JSON string)
  const parseMedia = (message) => {
    if (!message.media) return [];
    try {
      const media = typeof message.media === 'string' ? JSON.parse(message.media) : message.media;
      return Array.isArray(media) ? media : [];
    } catch (error) {
      console.error('Failed to parse media:', error);
      return [];
    }
  };

  // Get media type from URL
  const getMediaType = (url) => {
    if (!url) return 'unknown';
    const lowerUrl = url.toLowerCase();
    // Images - match all formats backend supports
    if (lowerUrl.match(/\.(jpg|jpeg|png|gif|webp|bmp)$/)) return 'image';
    // Videos - match all formats backend supports
    if (lowerUrl.match(/\.(mp4|webm|mov|avi|mpg|mpeg|3gp)$/)) return 'video';
    // Audio - match all formats backend supports
    if (lowerUrl.match(/\.(mp3|wav|ogg|m4a|aac)$/)) return 'audio';
    // Documents and other files
    return 'file';
  };

  // Download media file
  const handleDownloadMedia = async (url, filename) => {
    try {
      // Check if URL is same-origin (our server) or cross-origin
      const isSameOrigin = url.startsWith(window.location.origin) || url.startsWith('/');
      
      if (isSameOrigin) {
        // Same-origin: Use fetch with credentials for better reliability
        try {
          const response = await fetch(url, { 
            mode: 'cors',
            credentials: 'include' // Include cookies if needed
          });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const blob = await response.blob();
          const blobUrl = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = blobUrl;
          link.download = filename || `media-${Date.now()}`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          window.URL.revokeObjectURL(blobUrl);
          return;
        } catch (fetchError) {
          console.warn('Fetch download failed, trying direct link:', fetchError);
        }
      }
      
      // Fallback: Direct download link (works for same-origin and CORS-enabled)
      const link = document.createElement('a');
      link.href = url;
      link.download = filename || `media-${Date.now()}`;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // If direct download doesn't work, open in new tab as last resort
      setTimeout(() => {
        // Check if download started (this is a best-effort check)
        // If user wants to save, they can right-click
      }, 100);
      
    } catch (error) {
      console.error('Failed to download media:', error);
      // Last resort: Open in new tab so user can right-click and save
      window.open(url, '_blank');
      setError('Download initiated. If it doesn\'t start, right-click the media and select "Save As".');
    }
  };

  // Get filename from URL
  const getFilenameFromUrl = (url) => {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      const filename = pathname.split('/').pop();
      return filename || `media-${Date.now()}`;
    } catch {
      return `media-${Date.now()}`;
    }
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
        // Find the deleted message before removing it
        const deletedMessage = messages.find(msg => msg._id === messageId);
        const deletedTimestamp = deletedMessage ? (deletedMessage.timestamp || deletedMessage.created_at) : null;
        
        // Get the last message timestamp before deletion
        const lastMessage = messages[messages.length - 1];
        const lastMessageTimestamp = lastMessage ? (lastMessage.timestamp || lastMessage.created_at) : null;
        
        // Check if deleted message was the last message
        const wasLastMessage = deletedTimestamp && lastMessageTimestamp && 
          deletedTimestamp === lastMessageTimestamp;
        
        // Remove message from UI
        setMessages(prev => prev.filter(msg => msg._id !== messageId));
        setMessageToDelete(null);
        
        // Notify parent to update conversations list
        if (onMessageDeleted && deletedMessage) {
          onMessageDeleted({
            messageId,
            phoneNumber: selectedChat?.phoneNumber,
            wasLastMessage: wasLastMessage || messages.length === 1
          });
        }
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
                    {/* Display media if available */}
                    {(() => {
                      const mediaItems = parseMedia(msg);
                      return mediaItems.length > 0 && (
                        <div className="message-media">
                          {mediaItems.map((mediaUrl, mediaIndex) => {
                            const mediaType = getMediaType(mediaUrl);
                            const filename = getFilenameFromUrl(mediaUrl);
                            
                            return (
                              <div key={mediaIndex} className="media-item">
                                {mediaType === 'image' && (
                                  <div className="media-image-wrapper">
                                    <img 
                                      src={mediaUrl} 
                                      alt="Shared image" 
                                      className="media-image"
                                      loading="lazy"
                                      onClick={() => setLightboxImage(mediaUrl)}
                                      onError={(e) => {
                                        e.target.style.display = 'none';
                                        e.target.nextSibling.style.display = 'flex';
                                      }}
                                    />
                                    <div className="media-fallback" style={{ display: 'none' }}>
                                      <FiPaperclip size={24} />
                                      <span>Image unavailable</span>
                                    </div>
                                    <button
                                      className="media-download-btn"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDownloadMedia(mediaUrl, filename);
                                      }}
                                      title="Download image"
                                    >
                                      <FiDownload size={16} />
                                    </button>
                                  </div>
                                )}
                                {mediaType === 'video' && (
                                  <div className="media-video-wrapper">
                                    <video 
                                      src={mediaUrl} 
                                      controls 
                                      className="media-video"
                                      preload="metadata"
                                    >
                                      Your browser does not support the video tag.
                                    </video>
                                    <button
                                      className="media-download-btn"
                                      onClick={() => handleDownloadMedia(mediaUrl, filename)}
                                      title="Download video"
                                    >
                                      <FiDownload size={16} />
                                    </button>
                                  </div>
                                )}
                                {mediaType === 'audio' && (
                                  <div className="media-audio-wrapper">
                                    <audio 
                                      src={mediaUrl} 
                                      controls 
                                      className="media-audio"
                                    >
                                      Your browser does not support the audio tag.
                                    </audio>
                                    <button
                                      className="media-download-btn"
                                      onClick={() => handleDownloadMedia(mediaUrl, filename)}
                                      title="Download audio"
                                    >
                                      <FiDownload size={16} />
                                    </button>
                                  </div>
                                )}
                                {mediaType === 'file' && (
                                  <div className="media-file-wrapper">
                                    <div className="media-file-icon">
                                      <FiPaperclip size={24} />
                                    </div>
                                    <div className="media-file-info">
                                      <span className="media-file-name">{filename}</span>
                                      <button
                                        className="media-download-btn-small"
                                        onClick={() => handleDownloadMedia(mediaUrl, filename)}
                                        title="Download file"
                                      >
                                        <FiDownload size={14} /> Download
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                    {/* Display text message if available */}
                    {(msg.body || msg.message) && (
                      <p>{msg.body || msg.message}</p>
                    )}
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

      {/* Selected Media Preview */}
      {selectedMedia.length > 0 && (
        <div className="selected-media-preview">
          {selectedMedia.map((mediaUrl, index) => {
            const mediaType = getMediaType(mediaUrl);
            return (
              <div key={index} className="preview-media-item">
                {mediaType === 'image' && (
                  <img src={mediaUrl} alt="Preview" className="preview-image" />
                )}
                {mediaType === 'video' && (
                  <video src={mediaUrl} className="preview-video" controls />
                )}
                {mediaType !== 'image' && mediaType !== 'video' && (
                  <div className="preview-file">
                    <FiPaperclip size={24} />
                    <span>{getFilenameFromUrl(mediaUrl)}</span>
                  </div>
                )}
                <button
                  className="preview-remove-btn"
                  onClick={() => removeMedia(index)}
                  title="Remove"
                >
                  <FiX size={16} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Input Area */}
      <form className="message-input-container" onSubmit={handleSendMessage}>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          multiple
          accept="image/*,video/*,audio/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          style={{ display: 'none' }}
        />
        <button 
          type="button" 
          className="attach-btn"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadingMedia || sending}
          title="Attach media"
        >
          {uploadingMedia ? <div className="spinner-small"></div> : <FiPaperclip />}
        </button>
        <textarea
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyDown={(e) => {
            // Allow Enter to send, Shift+Enter for new line
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              if (newMessage.trim() && !sending) {
                handleSendMessage(e);
              }
            }
          }}
          placeholder="Type a message..."
          disabled={sending}
          rows={1}
          className="message-textarea"
        />
        <button 
          type="submit" 
          className="send-btn" 
          disabled={(!newMessage.trim() && selectedMedia.length === 0) || sending || uploadingMedia}
          title={(!newMessage.trim() && selectedMedia.length === 0) ? "Type a message or attach media to send" : "Send message"}
        >
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

      {/* Image Lightbox Modal */}
      {lightboxImage && (
        <div className="lightbox-overlay" onClick={() => setLightboxImage(null)}>
          <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
            <button 
              className="lightbox-close" 
              onClick={() => setLightboxImage(null)}
              title="Close"
            >
              <FiX size={24} />
            </button>
            <img 
              src={lightboxImage} 
              alt="Full size" 
              className="lightbox-image"
              onClick={(e) => e.stopPropagation()}
            />
            <button
              className="lightbox-download"
              onClick={() => {
                handleDownloadMedia(lightboxImage, getFilenameFromUrl(lightboxImage));
              }}
              title="Download image"
            >
              <FiDownload size={20} />
            </button>
          </div>
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
