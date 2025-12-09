import { useState, useEffect, useRef } from 'react';
import { FiSend, FiPhone, FiPaperclip, FiArrowLeft } from 'react-icons/fi';
import api from '../../services/api';
import { useSocket } from '../../context/SocketContext';
import './ChatArea.css';

function ChatArea({ selectedChat, onBack }) {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);
  const socket = useSocket();

  useEffect(() => {
    if (selectedChat) {
      loadMessages();
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

  const loadMessages = async () => {
    if (!selectedChat) return;
    
    setLoading(true);
    try {
      const res = await api.post('/setting/message-list', {
        phoneNumber: selectedChat.phoneNumber
      });
      
      if (res.data.status === 'true') {
        setMessages(res.data.data || []);
      }
    } catch (error) {
      console.error('Failed to load messages:', error);
    }
    setLoading(false);
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedChat) return;

    setSending(true);
    try {
      const res = await api.post('/setting/send-sms', {
        to: selectedChat.phoneNumber,
        body: newMessage
      });

      if (res.data.status === 'true') {
        const sentMessage = {
          body: newMessage,
          to: selectedChat.phoneNumber,
          from: 'me',
          timestamp: new Date().toISOString(),
          direction: 'outbound'
        };
        setMessages(prev => [...prev, sentMessage]);
        setNewMessage('');
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      alert('Failed to send message');
    }
    setSending(false);
  };

  const formatPhoneNumber = (phone) => {
    if (!phone) return '';
    return phone.replace(/(\d{1})(\d{3})(\d{3})(\d{4})/, '+$1 ($2) $3-$4');
  };

  const formatMessageTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
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

  return (
    <div className="chat-area">
      <div className="chat-header">
        <button className="back-btn" onClick={onBack}>
          <FiArrowLeft />
        </button>
        <div className="chat-contact-info">
          <div className="chat-avatar">
            <FiPhone />
          </div>
          <div>
            <h3>{formatPhoneNumber(selectedChat.phoneNumber)}</h3>
            <p>Tap to view contact</p>
          </div>
        </div>
        <div className="chat-actions">
          <button className="icon-btn" title="Call">
            <FiPhone />
          </button>
        </div>
      </div>

      <div className="messages-container">
        {loading ? (
          <div className="loading-messages">Loading messages...</div>
        ) : messages.length === 0 ? (
          <div className="no-messages">
            <p>No messages yet. Start the conversation!</p>
          </div>
        ) : (
          messages.map((msg, index) => (
            <div
              key={index}
              className={`message ${msg.direction === 'outbound' || msg.from === 'me' ? 'outgoing' : 'incoming'}`}
            >
              <div className="message-content">
                <p>{msg.body}</p>
                {msg.mediaUrl && (
                  <img src={msg.mediaUrl} alt="attachment" className="message-media" />
                )}
                <span className="message-time">{formatMessageTime(msg.timestamp)}</span>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <form className="message-input-container" onSubmit={handleSendMessage}>
        <button type="button" className="icon-btn" title="Attach file">
          <FiPaperclip />
        </button>
        <input
          type="text"
          placeholder="Type a message"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          disabled={sending}
        />
        <button type="submit" className="send-btn" disabled={sending || !newMessage.trim()}>
          <FiSend />
        </button>
      </form>
    </div>
  );
}

export default ChatArea;
