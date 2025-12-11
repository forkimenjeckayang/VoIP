import { useState, useEffect } from 'react';
import { FiPhone, FiPhoneOff, FiArrowDown, FiArrowUp, FiClock, FiUser, FiTrash2, FiX } from 'react-icons/fi';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import './CallHistory.css';
import '../shared/Modal.css';

function CallHistory() {
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, incoming, outgoing
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);
  const [callToDelete, setCallToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const { user } = useAuth();
  const socket = useSocket();

  useEffect(() => {
    loadCallHistory();
  }, []);

  // Listen for new calls to update history in real-time
  useEffect(() => {
    if (socket) {
      const handleUserMessage = (data) => {
        // Reload call history when a call event is received
        if (data.message === 'call') {
          loadCallHistory();
        }
      };

      socket.on('user_message', handleUserMessage);

      return () => {
        if (socket) {
          socket.off('user_message', handleUserMessage);
        }
      };
    }
  }, [socket]);

  const loadCallHistory = async () => {
    setLoading(true);
    try {
      const res = await api.post('/call/history', {
        user: user?.id || user?._id
      });
      if (res.data.status) {
        setCalls(res.data.data || []);
      }
    } catch (error) {
      console.error('Failed to load call history:', error);
    }
    setLoading(false);
  };

  const formatPhoneNumber = (phone) => {
    if (!phone) return '';
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 11 && cleaned.startsWith('1')) {
      return cleaned.replace(/(\d{1})(\d{3})(\d{3})(\d{4})/, '+$1 ($2) $3-$4');
    } else if (cleaned.length === 10) {
      return cleaned.replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3');
    }
    return phone;
  };

  const formatDuration = (seconds) => {
    if (!seconds) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (date) => {
    if (!date) return '';
    const d = new Date(date);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (d.toDateString() === today.toDateString()) {
      return `Today, ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } else if (d.toDateString() === yesterday.toDateString()) {
      return `Yesterday, ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } else {
      return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
  };

  const getCallIcon = (type) => {
    if (type === 'receive') {
      return <FiArrowDown className="call-icon incoming" />;
    }
    return <FiArrowUp className="call-icon outgoing" />;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return '#4CAF50';
      case 'failed':
      case 'busy':
      case 'no-answer':
        return '#f44336';
      case 'canceled':
        return '#ff9800';
      default:
        return '#888';
    }
  };

  const filteredCalls = calls.filter(call => {
    if (filter === 'all') return true;
    if (filter === 'incoming') return call.type === 'receive';
    if (filter === 'outgoing') return call.type === 'send';
    return true;
  });

  const getContactName = (call) => {
    if (call.contact) {
      return `${call.contact.first_name || ''} ${call.contact.last_name || ''}`.trim();
    }
    return null;
  };

  const handleDeleteClick = (call) => {
    setCallToDelete(call);
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = async () => {
    if (!callToDelete) return;
    
    setDeleting(true);
    try {
      const res = await api.post('/call/delete', {
        call_id: callToDelete._id,
        user: user?.id || user?._id
      });
      
      if (res.data.status) {
        // Remove the call from the list
        setCalls(prevCalls => prevCalls.filter(call => call._id !== callToDelete._id));
        setShowDeleteConfirm(false);
        setCallToDelete(null);
      } else {
        alert('Failed to delete call: ' + (res.data.message || 'Unknown error'));
      }
    } catch (error) {
      console.error('Failed to delete call:', error);
      alert('Failed to delete call. Please try again.');
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteAllClick = () => {
    setShowDeleteAllConfirm(true);
  };

  const handleDeleteAllConfirm = async () => {
    setDeleting(true);
    try {
      const res = await api.post('/call/delete-all', {
        user: user?.id || user?._id
      });
      
      if (res.data.status) {
        setCalls([]);
        setShowDeleteAllConfirm(false);
        alert(`Successfully deleted ${res.data.deletedCount || 0} call(s)`);
      } else {
        alert('Failed to delete calls: ' + (res.data.message || 'Unknown error'));
      }
    } catch (error) {
      console.error('Failed to delete all calls:', error);
      alert('Failed to delete calls. Please try again.');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="call-history-container">
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading call history...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="call-history-container">
      <div className="call-history-header">
        <h2>📞 Call History</h2>
        <div className="header-actions">
          <div className="filter-buttons">
            <button
              className={filter === 'all' ? 'active' : ''}
              onClick={() => setFilter('all')}
            >
              All
            </button>
            <button
              className={filter === 'incoming' ? 'active' : ''}
              onClick={() => setFilter('incoming')}
            >
              Incoming
            </button>
            <button
              className={filter === 'outgoing' ? 'active' : ''}
              onClick={() => setFilter('outgoing')}
            >
              Outgoing
            </button>
          </div>
          {filteredCalls.length > 0 && (
            <button
              className="delete-all-btn"
              onClick={handleDeleteAllClick}
              title="Delete all calls"
            >
              <FiTrash2 /> Delete All
            </button>
          )}
        </div>
      </div>

      {filteredCalls.length === 0 ? (
        <div className="empty-state">
          <FiPhone size={48} />
          <p>No call history</p>
          <small>Your calls will appear here</small>
        </div>
      ) : (
        <div className="calls-list">
          {filteredCalls.map((call) => {
            const contactName = getContactName(call);
            const displayName = contactName || formatPhoneNumber(call.number);
            
            return (
              <div key={call._id} className="call-item">
                <div className="call-icon-wrapper">
                  {getCallIcon(call.type)}
                </div>
                <div className="call-info">
                  <div className="call-header">
                    <h4>{displayName}</h4>
                    <span className="call-time">{formatDate(call.created_at)}</span>
                  </div>
                  <div className="call-details">
                    <span className="call-number">{formatPhoneNumber(call.number)}</span>
                    {call.duration && (
                      <span className="call-duration">
                        <FiClock size={12} /> {formatDuration(call.duration)}
                      </span>
                    )}
                    {call.status && (
                      <span 
                        className="call-status"
                        style={{ color: getStatusColor(call.status) }}
                      >
                        {call.status}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  className="delete-call-btn"
                  onClick={() => handleDeleteClick(call)}
                  title="Delete call"
                >
                  <FiTrash2 size={16} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="modal-overlay" onClick={() => !deleting && setShowDeleteConfirm(false)}>
          <div className="modal-content delete-confirm-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Delete Call</h3>
            <p>Are you sure you want to delete this call record?</p>
            {callToDelete && (
              <div className="call-preview">
                <p><strong>{getContactName(callToDelete) || formatPhoneNumber(callToDelete.number)}</strong></p>
                <p className="call-preview-time">{formatDate(callToDelete.created_at)}</p>
              </div>
            )}
            <div className="modal-actions">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setCallToDelete(null);
                }}
                className="cancel-btn"
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="delete-btn"
                disabled={deleting}
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete All Confirmation Modal */}
      {showDeleteAllConfirm && (
        <div className="modal-overlay" onClick={() => !deleting && setShowDeleteAllConfirm(false)}>
          <div className="modal-content delete-confirm-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Delete All Calls</h3>
            <p>Are you sure you want to delete all {filteredCalls.length} call record(s)?</p>
            <p className="warning-text">This action cannot be undone.</p>
            <div className="modal-actions">
              <button
                onClick={() => setShowDeleteAllConfirm(false)}
                className="cancel-btn"
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAllConfirm}
                className="delete-btn"
                disabled={deleting}
              >
                {deleting ? 'Deleting...' : 'Delete All'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CallHistory;

