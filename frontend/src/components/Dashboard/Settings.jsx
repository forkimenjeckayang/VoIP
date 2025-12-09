import { useState, useEffect } from 'react';
import { FiPhone, FiDollarSign, FiPlus, FiTrash2, FiCheck, FiX, FiCheckCircle, FiAlertCircle } from 'react-icons/fi';
import { useAuth } from '../../context/AuthContext';
import { useVoice } from '../../context/VoiceContext';
import api from '../../services/api';
import './Settings.css';
import '../shared/Modal.css';

function Settings() {
  const { user } = useAuth();
  const { selectedProfile, setSelectedProfile } = useVoice();
  const [profiles, setProfiles] = useState([]);
  const [balance, setBalance] = useState(null);
  const [availableNumbers, setAvailableNumbers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNumberModal, setShowNumberModal] = useState(false);
  const [showProfileNameModal, setShowProfileNameModal] = useState(false);
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [alertMessage, setAlertMessage] = useState({ type: '', message: '' });
  const [loadingNumbers, setLoadingNumbers] = useState(false);
  const [selectedNumber, setSelectedNumber] = useState(null);
  const [profileName, setProfileName] = useState('');

  useEffect(() => {
    loadData();
  }, []);

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
        showAlert('success', 'Number added successfully!');
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
    showAlert('success', `${profile.profile} is now active`);
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

  return (
    <div className="settings-container">
      <div className="settings-header">
        <h2>Settings</h2>
      </div>

      {loading ? (
        <div className="loading-state">Loading...</div>
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

          <div className="settings-section">
            <div className="section-header">
              <h3><FiDollarSign /> Account Balance</h3>
            </div>
            <div className="balance-card">
              <div className="balance-amount">
                ${balance !== null ? balance : '-.--'}
              </div>
              <p>Twilio Account Balance</p>
            </div>
          </div>

          <div className="settings-section">
            <div className="section-header">
              <h3><FiPhone /> Your Numbers</h3>
              <button onClick={openNumberModal} className="add-number-btn">
                <FiPlus /> Add Number
              </button>
            </div>

            {profiles.length === 0 ? (
              <div className="empty-profiles">
                <p>No phone numbers configured yet</p>
                <button onClick={openNumberModal}>Add your first number</button>
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
                        <span className="profile-country">{profile.country}</span>
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
            <h3>Available Numbers</h3>
            {loadingNumbers ? (
              <div className="loading-state">Loading available numbers...</div>
            ) : availableNumbers.length === 0 ? (
              <div className="empty-state">
                <p>No available numbers found in your Twilio account</p>
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
                    <button onClick={() => handleNumberClick(number)}>
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
            <h3>Name Your Profile</h3>
            <div className="form-group">
              <label>Profile Name</label>
              <input
                type="text"
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                placeholder="e.g., Personal, Work, Business"
                autoFocus
                onKeyPress={(e) => {
                  if (e.key === 'Enter') handleAddNumber();
                }}
              />
            </div>
            <p className="number-preview">
              Number: {formatPhoneNumber(selectedNumber?.phoneNumber)}
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
    </div>
  );
}

export default Settings;
