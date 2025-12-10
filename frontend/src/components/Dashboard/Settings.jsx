import { useState, useEffect } from 'react';
import { FiPhone, FiDollarSign, FiPlus, FiTrash2, FiCheckCircle, FiAlertCircle, FiMessageSquare, FiClock, FiTrendingUp } from 'react-icons/fi';
import { useAuth } from '../../context/AuthContext';
import { useVoice } from '../../context/VoiceContext';
import { useSocket } from '../../context/SocketContext';
import api from '../../services/api';
import './Settings.css';
import '../shared/Modal.css';

function Settings() {
  const { user } = useAuth();
  const { selectedProfile, setSelectedProfile } = useVoice();
  const socket = useSocket();
  const [profiles, setProfiles] = useState([]);
  const [balance, setBalance] = useState(null);
  const [stats, setStats] = useState({ messages: 0, calls: 0, uptime: '0 days' });
  const [availableNumbers, setAvailableNumbers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNumberModal, setShowNumberModal] = useState(false);
  const [showProfileNameModal, setShowProfileNameModal] = useState(false);
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [alertMessage, setAlertMessage] = useState({ type: '', message: '' });
  const [loadingNumbers, setLoadingNumbers] = useState(false);
  const [selectedNumber, setSelectedNumber] = useState(null);
  const [profileName, setProfileName] = useState('');
  const [showUsernameModal, setShowUsernameModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  useEffect(() => {
    loadData();
    calculateStats();
  }, []);

  // Listen for profile deletion events from socket
  useEffect(() => {
    if (socket) {
      const handleProfileDeleted = (data) => {
        console.log('🗑️ Profile deleted via socket:', data);
        // Reload profiles to reflect deletion
        loadProfiles();
        // If deleted profile was selected, clear selection
        if (selectedProfile?._id === data.profile_id) {
          setSelectedProfile(null);
        }
      };

      socket.on('profile_deleted', handleProfileDeleted);

      return () => {
        if (socket) {
          socket.off('profile_deleted', handleProfileDeleted);
        }
      };
    }
  }, [socket, selectedProfile, setSelectedProfile]);

  const calculateStats = () => {
    // Calculate account uptime
    if (user?.created_at) {
      const created = new Date(user.created_at);
      const now = new Date();
      const diffDays = Math.floor((now - created) / (1000 * 60 * 60 * 24));
      setStats(prev => ({ ...prev, uptime: `${diffDays} days` }));
    }
  };

  const loadData = async () => {
    setLoading(true);
    await Promise.all([
      loadProfiles(),
      loadBalance()
    ]);
    setLoading(false);
  };

  const loadProfiles = async () => {
    try {
      const res = await api.post('/profile/getdata');
      if (res.data.status) {
        const profileList = res.data.data || [];
        setProfiles(profileList);

        // Auto-select first profile if none selected
        if (!selectedProfile && profileList.length > 0) {
          setSelectedProfile(profileList[0]);
        }
      }
    } catch (error) {
      console.error('Failed to load profiles:', error);
    }
  };

  const loadBalance = async () => {
    try {
      const res = await api.post('/setting/get-balance');
      if (res.data.status) {
        const balanceValue = res.data.data?.balance || null;
        setBalance(balanceValue);
      }
    } catch (error) {
      console.error('Failed to load balance:', error);
    }
  };

  const loadAvailableNumbers = async () => {
    setLoadingNumbers(true);
    try {
      const res = await api.post('/setting/get-number');
      if (res.data.status) {
        setAvailableNumbers(res.data.data || []);
      }
    } catch (error) {
      console.error('Failed to load numbers:', error);
      showAlert('error', 'Failed to load available numbers');
    }
    setLoadingNumbers(false);
  };

  const showAlert = (type, message) => {
    setAlertMessage({ type, message });
    setShowAlertModal(true);
  };

  const handleNumberClick = (number) => {
    setSelectedNumber(number);
    setShowNumberModal(false);
    setShowProfileNameModal(true);
  };

  const handleAddNumber = async () => {
    if (!profileName.trim()) {
      showAlert('error', 'Please enter a profile name');
      return;
    }

    try {
      if (!user?._id) {
        showAlert('error', 'User not found. Please log in again.');
        return;
      }

      const res = await api.post('/setting/create', {
        user: user._id,
        profile: profileName,
        sid: selectedNumber.sid
      });

      if (res.data.status) {
        showAlert('success', '✨ Number added successfully!');
        setShowProfileNameModal(false);
        setProfileName('');
        await loadProfiles();
      } else {
        showAlert('error', res.data.message || 'Failed to add number');
      }
    } catch (error) {
      console.error('Failed to add number:', error);
      showAlert('error', error.response?.data?.message || 'Failed to add number');
    }
  };

  const handleDeleteProfile = async (profile) => {
    try {
      const res = await api.post('/setting/delete-key', {
        user: user._id,
        profile_id: profile._id
      });
      if (res.data.status) {
        showAlert('success', 'Profile deleted successfully');

        // If deleted profile was selected, clear selection
        if (selectedProfile?._id === profile._id) {
          setSelectedProfile(null);
        }

        loadProfiles();
      }
    } catch (error) {
      console.error('Failed to delete profile:', error);
      showAlert('error', 'Failed to delete profile');
    }
  };

  const handleSetActive = (profile) => {
    setSelectedProfile(profile);
    showAlert('success', `${profile.profile} is now active ✨`);
  };

  const formatPhoneNumber = (phone) => {
    if (!phone) return '';
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 11 && cleaned.startsWith('1')) {
      return cleaned.replace(/(\d{1})(\d{3})(\d{3})(\d{4})/, '+$1 ($2) $3-$4');
    }
    return phone;
  };

  const openNumberModal = () => {
    setShowNumberModal(true);
    loadAvailableNumbers();
  };

  const handleUpdateUsername = async () => {
    if (!newUsername.trim()) {
      showAlert('error', 'Please enter a display name');
      return;
    }

    try {
      const res = await api.post('/auth/username/update', {
        name: newUsername.trim()
      });

      if (res.data.status) {
        showAlert('success', '✨ Display name updated successfully!');
        setShowUsernameModal(false);
        setNewUsername('');
        // Reload user data
        window.location.reload();
      }
    } catch (error) {
      console.error('Failed to update display name:', error);
      showAlert('error', error.response?.data?.message || 'Failed to update display name');
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'DELETE') {
      showAlert('error', 'Please type DELETE to confirm');
      return;
    }

    try {
      const res = await api.post('/auth/user/delete');

      if (res.data.status) {
        showAlert('success', 'Account deleted. Logging out...');
        setTimeout(() => {
          localStorage.clear();
          window.location.href = '/login';
        }, 2000);
      }
    } catch (error) {
      console.error('Failed to delete account:', error);
      showAlert('error', error.response?.data?.message || 'Failed to delete account');
    }
  };

  const getInitials = (email) => {
    if (!email) return '?';
    return email.charAt(0).toUpperCase();
  };

  return (
    <div className="settings-container">
      {/* Profile Header */}
      <div className="profile-header">
        <div className="profile-avatar-large">
          {getInitials(user?.email)}
        </div>
        <div className="profile-header-info">
          <h2>{user?.name || user?.email}</h2>
          <p className="profile-email">{user?.email}</p>
          <p className="profile-member-since">
            Member since {new Date(user?.created_at || Date.now()).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </p>
          <div className="profile-actions-header">
            <button onClick={() => {
              setNewUsername(user?.name || '');
              setShowUsernameModal(true);
            }} className="update-username-btn">
              ✏️ Update Display Name
            </button>
            <button onClick={() => setShowDeleteModal(true)} className="delete-account-btn">
              🗑️ Delete Account
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading your settings...</p>
        </div>
      ) : (
        <>
          {/* Active Profile Banner */}
          {selectedProfile && (
            <div className="active-profile-banner">
              <FiCheckCircle className="check-icon" />
              <div className="active-info">
                <h4>Active Profile</h4>
                <p className="profile-name">{selectedProfile.profile}</p>
                <p className="phone-number">{formatPhoneNumber(selectedProfile.phoneNumber)}</p>
              </div>
            </div>
          )}

          {/* Stats Grid */}
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-icon messages">
                <FiMessageSquare />
              </div>
              <div className="stat-content">
                <h4>Messages</h4>
                <p className="stat-value">{stats.messages}</p>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon calls">
                <FiPhone />
              </div>
              <div className="stat-content">
                <h4>Calls</h4>
                <p className="stat-value">{stats.calls}</p>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon uptime">
                <FiClock />
              </div>
              <div className="stat-content">
                <h4>Uptime</h4>
                <p className="stat-value">{stats.uptime}</p>
              </div>
            </div>
          </div>

          <div className="settings-section">
            <div className="section-header">
              <h3><FiDollarSign /> Account Balance</h3>
            </div>
            <div className="balance-card">
              <div className="balance-amount">
                ${balance !== null ? balance : '-.--'}
              </div>
              <p>Twilio Account Balance</p>
              <div className="balance-indicator">
                <FiTrendingUp /> <span>Active</span>
              </div>
            </div>
          </div>

          <div className="settings-section">
            <div className="section-header">
              <h3><FiPhone /> Your Phone Numbers</h3>
              <button onClick={openNumberModal} className="add-number-btn">
                <FiPlus /> Add Number
              </button>
            </div>

            {profiles.length === 0 ? (
              <div className="empty-profiles">
                <div className="empty-icon">
                  <FiPhone />
                </div>
                <h4>No phone numbers yet</h4>
                <p>Add your first Twilio number to start making calls and sending messages</p>
                <button onClick={openNumberModal} className="primary-btn">
                  <FiPlus /> Add Your First Number
                </button>
              </div>
            ) : (
              <div className="profiles-list">
                {profiles.map((profile) => (
                  <div
                    key={profile._id}
                    className={`profile-card ${selectedProfile?._id === profile._id ? 'active' : ''}`}
                  >
                    <div className="profile-icon">
                      <FiPhone />
                    </div>
                    <div className="profile-info">
                      <h4>{profile.profile}</h4>
                      <p>{formatPhoneNumber(profile.phoneNumber)}</p>
                      {profile.country && (
                        <span className="profile-country">🌍 {profile.country}</span>
                      )}
                    </div>
                    <div className="profile-actions">
                      {selectedProfile?._id !== profile._id && (
                        <button
                          onClick={() => handleSetActive(profile)}
                          className="set-active-btn"
                          title="Set as active"
                        >
                          Set Active
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteProfile(profile)}
                        className="delete-profile-btn"
                        title="Delete Profile"
                      >
                        <FiTrash2 />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Available Numbers Modal */}
      {showNumberModal && (
        <div className="modal-overlay" onClick={() => setShowNumberModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>📱 Available Numbers</h3>
            {loadingNumbers ? (
              <div className="loading-state">
                <div className="spinner"></div>
                <p>Loading available numbers...</p>
              </div>
            ) : availableNumbers.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">
                  <FiPhone />
                </div>
                <p>No available numbers found</p>
                <small>Purchase numbers from your Twilio console first</small>
              </div>
            ) : (
              <div className="numbers-list">
                {availableNumbers.map((number, index) => (
                  <div key={index} className="number-item">
                    <div>
                      <strong>{formatPhoneNumber(number.phoneNumber)}</strong>
                      {number.friendlyName && (
                        <p className="number-friendly">{number.friendlyName}</p>
                      )}
                    </div>
                    <button onClick={() => handleNumberClick(number)} className="primary-btn">
                      Add
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="modal-actions">
              <button onClick={() => setShowNumberModal(false)} className="cancel-btn">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Profile Name Modal */}
      {showProfileNameModal && (
        <div className="modal-overlay" onClick={() => setShowProfileNameModal(false)}>
          <div className="modal-content profile-name-modal" onClick={(e) => e.stopPropagation()}>
            <h3>✨ Name Your Profile</h3>
            <div className="form-group">
              <label>Profile Name</label>
              <input
                type="text"
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                placeholder="e.g., Personal, Work, Business"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddNumber();
                }}
              />
            </div>
            <p className="number-preview">
              📞 Number: {formatPhoneNumber(selectedNumber?.phoneNumber)}
            </p>
            <div className="modal-actions">
              <button onClick={() => setShowProfileNameModal(false)} className="cancel-btn">
                Cancel
              </button>
              <button onClick={handleAddNumber} className="confirm-btn">
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Alert Modal */}
      {showAlertModal && (
        <div className="modal-overlay" onClick={() => setShowAlertModal(false)}>
          <div className={`modal-content alert-modal ${alertMessage.type}`} onClick={(e) => e.stopPropagation()}>
            <div className="icon">
              {alertMessage.type === 'success' ? <FiCheckCircle /> : <FiAlertCircle />}
            </div>
            <h3>{alertMessage.type === 'success' ? 'Success' : 'Error'}</h3>
            <p>{alertMessage.message}</p>
            <div className="modal-actions">
              <button onClick={() => setShowAlertModal(false)} className="confirm-btn">
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Update Username Modal */}
      {showUsernameModal && (
        <div className="modal-overlay" onClick={() => setShowUsernameModal(false)}>
          <div className="modal-content profile-name-modal" onClick={(e) => e.stopPropagation()}>
            <h3>✏️ Update Display Name</h3>
            <div className="form-group">
              <label>Display Name</label>
              <input
                type="text"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                placeholder="Enter your display name"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleUpdateUsername();
                }}
              />
              <small style={{ color: '#888', marginTop: '4px', display: 'block' }}>
                This is how your name will be displayed. Your email remains {user?.email}
              </small>
            </div>
            <div className="modal-actions">
              <button onClick={() => setShowUsernameModal(false)} className="cancel-btn">
                Cancel
              </button>
              <button onClick={handleUpdateUsername} className="confirm-btn">
                Update
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Account Modal */}
      {showDeleteModal && (
        <div className="modal-overlay" onClick={() => setShowDeleteModal(false)}>
          <div className="modal-content alert-modal error" onClick={(e) => e.stopPropagation()}>
            <div className="icon">
              <FiAlertCircle />
            </div>
            <h3>⚠️ Delete Account</h3>
            <p><strong>This action cannot be undone!</strong></p>
            <p>All your data will be permanently deleted:</p>
            <ul className="delete-warning-list">
              <li>All phone numbers will be released</li>
              <li>All contacts will be deleted</li>
              <li>All messages will be deleted</li>
              <li>All settings will be removed</li>
            </ul>
            <div className="form-group">
              <label>Type <strong>DELETE</strong> to confirm:</label>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="Type DELETE"
                autoFocus
              />
            </div>
            <div className="modal-actions">
              <button onClick={() => {
                setShowDeleteModal(false);
                setDeleteConfirmText('');
              }} className="cancel-btn">
                Cancel
              </button>
              <button onClick={handleDeleteAccount} className="delete-confirm-btn">
                Delete Forever
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Settings;
