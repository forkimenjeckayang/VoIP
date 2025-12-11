import { useState, useEffect } from 'react';
import { FiPhone, FiPhoneOff, FiDelete, FiMic, FiMicOff, FiUser, FiUsers, FiAlertCircle, FiCheckCircle } from 'react-icons/fi';
import { useVoice } from '../../context/VoiceContext';
import api from '../../services/api';
import './Dialer.css';
import '../shared/Modal.css';

function Dialer() {
    const [phoneNumber, setPhoneNumber] = useState('');
    const [profiles, setProfiles] = useState([]);
    const [contacts, setContacts] = useState([]);
    const [showContacts, setShowContacts] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [showAlertModal, setShowAlertModal] = useState(false);
    const [alertMessage, setAlertMessage] = useState({ type: '', message: '' });
    const {
        call,
        callStatus,
        selectedProfile,
        setSelectedProfile,
        makeCall,
        hangup,
        acceptCall,
        rejectCall,
        toggleMute
    } = useVoice();

    useEffect(() => {
        loadProfiles();
        loadContacts();
    }, []);

    // Reset UI when call status changes to 'ended' - ensure immediate reset
    useEffect(() => {
        if (callStatus === 'ended') {
            // Immediately reset to allow dial pad to work again
            // VoiceContext will also reset, but we ensure UI is ready
            setTimeout(() => {
                // Force re-enable if still in ended state
                if (callStatus === 'ended') {
                    // This will be handled by VoiceContext, but ensure UI updates
                }
            }, 100);
        }
    }, [callStatus]);

    const loadProfiles = async () => {
        try {
            const res = await api.post('/profile/getdata');
            if (res.data.status) {
                setProfiles(res.data.data || []);
                if (res.data.data && res.data.data.length > 0 && !selectedProfile) {
                    setSelectedProfile(res.data.data[0]);
                }
            }
        } catch (error) {
            console.error('Failed to load profiles:', error);
        }
    };

    const loadContacts = async () => {
        try {
            const res = await api.get('/contact/get-all');
            if (res.data.status) {
                setContacts(res.data.data || []);
            }
        } catch (error) {
            console.error('Failed to load contacts:', error);
        }
    };

    const handleContactSelect = (contact) => {
        setPhoneNumber(contact.number);
        setShowContacts(false);
    };

    const handleNumberClick = (num) => {
        // Allow + only at the beginning
        if (num === '+') {
            if (!phoneNumber.startsWith('+')) {
                setPhoneNumber('+' + phoneNumber);
            }
        } else {
            setPhoneNumber(prev => prev + num);
        }
    };

    const handleDelete = () => {
        setPhoneNumber(prev => prev.slice(0, -1));
    };

    const showAlert = (type, message) => {
        setAlertMessage({ type, message });
        setShowAlertModal(true);
    };

    const handleCall = () => {
        if (!selectedProfile) {
            showAlert('error', 'Please select a phone number profile first. Go to Settings to select one.');
            return;
        }

        // Remove + for validation, then check length
        const digitsOnly = phoneNumber.replace(/[^0-9]/g, '');
        if (digitsOnly.length < 10) {
            showAlert('error', 'Please enter a valid phone number (at least 10 digits)');
            return;
        }

        makeCall(phoneNumber, (error) => {
            showAlert('error', error);
        });
    };

    const handleHangup = () => {
        hangup();
        // Don't clear phone number - let user keep it for next call
        // setPhoneNumber('');
    };

    const handleAccept = () => {
        acceptCall();
    };

    const handleReject = () => {
        rejectCall();
    };

    const handleToggleMute = () => {
        const newMuteState = toggleMute();
        setIsMuted(newMuteState);
    };

    // Sync mute state with call
    useEffect(() => {
        if (call) {
            setIsMuted(call.isMuted());
            // Listen for mute changes from call object
            const handleMuteChange = () => {
                setIsMuted(call.isMuted());
            };
            // Note: Twilio SDK doesn't have a direct mute event, so we check on status changes
        } else {
            setIsMuted(false);
        }
    }, [call, callStatus]);

    const formatPhoneNumber = (phone) => {
        if (!phone) return '';
        const cleaned = phone.replace(/\D/g, '');
        if (cleaned.length === 11 && cleaned.startsWith('1')) {
            return cleaned.replace(/(\d{1})(\d{3})(\d{3})(\d{4})/, '+$1 ($2) $3-$4');
        }
        return phone;
    };

    const getInitials = (contact) => {
        const first = contact.first_name?.charAt(0) || '';
        const last = contact.last_name?.charAt(0) || '';
        return (first + last).toUpperCase() || '?';
    };

    const dialPad = [
        ['1', '2', '3'],
        ['4', '5', '6'],
        ['7', '8', '9'],
        ['+', '*', '0', '#']
    ];

    const getStatusDisplay = () => {
        switch (callStatus) {
            case 'connecting': return 'Connecting...';
            case 'ringing': return `Incoming call from ${call?.parameters?.From || 'Unknown'}`;
            case 'active': return 'Call in progress';
            case 'ended': return 'Call ended';
            default: return selectedProfile ? formatPhoneNumber(selectedProfile.phoneNumber) : 'No profile selected';
        }
    };

    return (
        <div className="dialer-container">
            <div className="dialer-header">
                <h2>☎️ Dialer</h2>
                {profiles.length > 0 && (
                    <select
                        value={selectedProfile?._id || ''}
                        onChange={(e) => {
                            const profile = profiles.find(p => p._id === e.target.value);
                            setSelectedProfile(profile);
                        }}
                        className="profile-select"
                    >
                        {profiles.map(profile => (
                            <option key={profile._id} value={profile._id}>
                                {profile.profile} - {formatPhoneNumber(profile.phoneNumber)}
                            </option>
                        ))}
                    </select>
                )}
            </div>

            <div className="call-status">
                <p className={`status-text ${callStatus}`}>{getStatusDisplay()}</p>
            </div>

            {callStatus === 'ringing' ? (
                <div className="incoming-call">
                    <h3>Incoming Call</h3>
                    <p>{call?.parameters?.From}</p>
                    <div className="call-actions">
                        <button onClick={handleAccept} className="accept-btn">
                            <FiPhone /> Accept
                        </button>
                        <button onClick={handleReject} className="reject-btn">
                            <FiPhoneOff /> Decline
                        </button>
                    </div>
                </div>
            ) : callStatus === 'active' ? (
                <div className="active-call">
                    <h3>Active Call</h3>
                    <p>{phoneNumber || call?.parameters?.From}</p>
                    <div className="call-controls">
                        <button
                            onClick={handleToggleMute}
                            className={`mute-btn ${isMuted ? 'muted' : ''}`}
                            title={isMuted ? 'Unmute' : 'Mute'}
                        >
                            {isMuted ? <FiMicOff size={24} /> : <FiMic size={24} />}
                        </button>
                    </div>
                    <button onClick={handleHangup} className="hangup-btn">
                        <FiPhoneOff size={20} /> Hang Up
                    </button>
                </div>
            ) : (
                <>
                    <div className="phone-display">
                        <input
                            type="text"
                            value={phoneNumber}
                            onChange={(e) => {
                                let value = e.target.value.replace(/[^0-9+]/g, '');
                                // Ensure + is only at the beginning
                                if (value.includes('+') && !value.startsWith('+')) {
                                    value = '+' + value.replace(/\+/g, '');
                                }
                                setPhoneNumber(value);
                            }}
                            placeholder="Enter phone number"
                            className="phone-input"
                            disabled={callStatus !== 'idle' && callStatus !== 'ended'}
                        />
                        <div className="phone-actions">
                            {phoneNumber && (
                                <button 
                                    onClick={handleDelete} 
                                    className="dialer-delete-btn"
                                    title="Delete last digit"
                                >
                                    <FiDelete />
                                </button>
                            )}
                            <button
                                onClick={() => setShowContacts(!showContacts)}
                                className="contacts-btn"
                                title="Select from contacts"
                            >
                                <FiUsers size={18} />
                            </button>
                        </div>
                    </div>

                    {showContacts && (
                        <div className="modal-overlay" onClick={() => setShowContacts(false)}>
                            <div className="modal-content contacts-modal" onClick={(e) => e.stopPropagation()}>
                                <div className="contacts-list-header">
                                    <h4>Select Contact</h4>
                                    <button onClick={() => setShowContacts(false)}>✕</button>
                                </div>

                                {contacts.length === 0 ? (
                                    <p className="no-contacts">No contacts available</p>
                                ) : (
                                    <div className="contacts-list-body">
                                        {contacts.map((contact) => (
                                            <div
                                                key={contact._id}
                                                className="contact-item"
                                                onClick={() => handleContactSelect(contact)}
                                            >
                                                <div className="contact-avatar-small">
                                                    {getInitials(contact)}
                                                </div>
                                                <div className="contact-item-info">
                                                    <strong>{contact.first_name} {contact.last_name}</strong>
                                                    <span>{formatPhoneNumber(contact.number)}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    <div className="dial-pad">
                        {dialPad.map((row, i) => (
                            <div key={i} className="dial-row">
                                {row.map((num) => (
                                    <button
                                        key={num}
                                        onClick={() => handleNumberClick(num)}
                                        className="dial-button"
                                        disabled={callStatus !== 'idle' && callStatus !== 'ended'}
                                    >
                                        {num}
                                    </button>
                                ))}
                            </div>
                        ))}
                    </div>

                    <button
                        onClick={handleCall}
                        className="call-button"
                        disabled={!phoneNumber || (callStatus !== 'idle' && callStatus !== 'ended') || !selectedProfile}
                    >
                        <FiPhone /> Call
                    </button>
                </>
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

export default Dialer;
