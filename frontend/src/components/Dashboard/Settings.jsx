import { useState, useEffect } from 'react';
import { FiPhone, FiDollarSign, FiPlus, FiTrash2 } from 'react-icons/fi';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import './Settings.css';

function Settings() {
  const { user } = useAuth(); // Get user from context (already fetched from API)
  const [profiles, setProfiles] = useState([]);
  const [balance, setBalance] = useState(null);
  const [availableNumbers, setAvailableNumbers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNumberModal, setShowNumberModal] = useState(false);
  const [loadingNumbers, setLoadingNumbers] = useState(false);

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
      if (res.data.status === 'true') {
        setProfiles(res.data.data || []);
      }
    } catch (error) {
      console.error('Failed to load profiles:', error);
    }
  };

  const loadBalance = async () => {
    try {
      const res = await api.post('/setting/get-balance');
      console.log('Balance response:', res.data);
      if (res.data.status) {
        // Backend returns: { status: true, data: { balance: "9.22", currency: "USD" } }
        const balanceValue = res.data.data?.balance || null;
        console.log('Setting balance to:', balanceValue);
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
      alert('Failed to load available numbers');
    }
    setLoadingNumbers(false);
  };

  const handleAddNumber = async (number) => {
    try {
      const profileName = prompt('Enter a name for this profile:');
      if (!profileName) return;

      // User comes from AuthContext (already authenticated via API)
      if (!user?._id) {
        alert('User not found. Please log in again.');
        return;
      }

      const res = await api.post('/setting/create', {
        user: user._id,
        profile: profileName,
        sid: number.sid
      });

      if (res.data.status) {
        alert('Number added successfully!');
        setShowNumberModal(false);
        loadProfiles();
      } else {
        alert(res.data.message || 'Failed to add number');
      }
    } catch (error) {
      console.error('Failed to add number:', error);
      alert(error.response?.data?.message || 'Failed to add number');
    }
  };

  const handleDeleteProfile = async (profileId) => {
    if (!confirm('Are you sure? This will release the number back to your Twilio account.')) return;

    try {
      // User comes from AuthContext (already authenticated via API)
      const res = await api.post('/setting/delete-key', {
        user: user._id,
        profile_id: profileId
      });
      if (res.data.status) {
        alert('Profile deleted successfully');
        loadProfiles();
      }
    } catch (error) {
      console.error('Failed to delete profile:', error);
      alert('Failed to delete profile');
    }
  };

  const formatPhoneNumber = (phone) => {
    if (!phone) return '';
    // Remove any existing + or formatting, then format
    const cleaned = phone.replace(/\D/g, '');
    // Format as +1 (XXX) XXX-XXXX
    if (cleaned.length === 11 && cleaned.startsWith('1')) {
      return cleaned.replace(/(\d{1})(\d{3})(\d{3})(\d{4})/, '+$1 ($2) $3-$4');
    }
    return phone; // Return as-is if not standard format
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
                  <div key={profile._id} className="profile-card">
                    <div className="profile-icon">
                      <FiPhone />
                    </div>
                    <div className="profile-info">
                      <h4>{profile.profile || 'Unnamed Profile'}</h4>
                      <p>{formatPhoneNumber(profile.phoneNumber)}</p>
                      {profile.country && (
                        <span className="profile-country">{profile.country}</span>
                      )}
                    </div>
                    <button
                      onClick={() => handleDeleteProfile(profile._id)}
                      className="delete-profile-btn"
                      title="Delete Profile"
                    >
                      <FiTrash2 />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

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
                    <button onClick={() => handleAddNumber(number)}>
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
    </div>
  );
}

export default Settings;
