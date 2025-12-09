import { useState, useEffect } from 'react';
import { FiPhone, FiPhoneOff, FiDelete, FiMic, FiMicOff } from 'react-icons/fi';
import { useVoice } from '../../context/VoiceContext';
import api from '../../services/api';
import './Dialer.css';

function Dialer() {
    const [phoneNumber, setPhoneNumber] = useState('');
    const [profiles, setProfiles] = useState([]);
    const [isMuted, setIsMuted] = useState(false);
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
    }, []);

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

    const handleNumberClick = (num) => {
        setPhoneNumber(prev => prev + num);
    };

    const handleDelete = () => {
        setPhoneNumber(prev => prev.slice(0, -1));
    };

    const handleCall = () => {
        if (!selectedProfile) {
            alert('Please select a phone number profile first (go to Settings)');
            return;
        }

        if (phoneNumber.length >= 10) {
            makeCall(phoneNumber);
        } else {
            alert('Please enter a valid phone number');
        }
    };

    const handleHangup = () => {
        hangup();
        setPhoneNumber('');
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

    const formatPhoneNumber = (phone) => {
        if (!phone) return '';
        const cleaned = phone.replace(/\\D/g, '');
        if (cleaned.length === 11 && cleaned.startsWith('1')) {
            return cleaned.replace(/(\\d{1})(\\d{3})(\\d{3})(\\d{4})/, '+$1 ($2) $3-$4');
        }
        return phone;
    };

    const dialPad = [
        ['1', '2', '3'],
        ['4', '5', '6'],
        ['7', '8', '9'],
        ['*', '0', '#']
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
                <h2>Dialer</h2>
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
                        >
                            {isMuted ? <FiMicOff /> : <FiMic />}
                        </button>
                    </div>
                    <button onClick={handleHangup} className="hangup-btn">
                        <FiPhoneOff /> Hang Up
                    </button>
                </div>
            ) : (
                <>
                    <div className="phone-display">
                        <input
                            type="text"
                            value={phoneNumber}
                            onChange={(e) => setPhoneNumber(e.target.value.replace(/[^0-9+]/g, ''))}
                            placeholder="Enter phone number"
                            className="phone-input"
                            disabled={callStatus !== 'idle'}
                        />
                        {phoneNumber && (
                            <button onClick={handleDelete} className="delete-btn">
                                <FiDelete />
                            </button>
                        )}
                    </div>

                    <div className="dial-pad">
                        {dialPad.map((row, i) => (
                            <div key={i} className="dial-row">
                                {row.map((num) => (
                                    <button
                                        key={num}
                                        onClick={() => handleNumberClick(num)}
                                        className="dial-button"
                                        disabled={callStatus !== 'idle'}
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
                        disabled={!phoneNumber || callStatus !== 'idle' || !selectedProfile}
                    >
                        <FiPhone /> Call
                    </button>
                </>
            )}
        </div>
    );
}

export default Dialer;
