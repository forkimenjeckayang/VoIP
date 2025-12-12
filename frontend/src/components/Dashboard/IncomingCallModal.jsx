import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FiPhone, FiPhoneOff } from 'react-icons/fi';
import { useVoice } from '../../context/VoiceContext';
import './IncomingCallModal.css';

const IncomingCallModal = () => {
    const { callStatus, call, acceptCall, rejectCall } = useVoice();
    const navigate = useNavigate();
    const location = useLocation();

    // If we are already on the dialer page, let the Dialer component handle the UI
    if (location.pathname === '/dialer') {
        return null;
    }

    // Only show if ringing
    if (callStatus !== 'ringing') {
        return null;
    }

    const handleAccept = () => {
        acceptCall();
        navigate('/dialer');
    };

    const handleReject = () => {
        rejectCall();
    };

    return (
        <div className="incoming-call-overlay">
            <div className="incoming-call-card">
                <div className="caller-info">
                    <h3>Incoming Call</h3>
                    <p className="caller-number">{call?.parameters?.From || 'Unknown Number'}</p>
                    <div className="pulsing-circle"></div>
                </div>
                
                <div className="call-actions">
                    <button onClick={handleAccept} className="accept-btn">
                        <FiPhone /> Accept
                    </button>
                    <button onClick={handleReject} className="reject-btn">
                        <FiPhoneOff /> Decline
                    </button>
                </div>
            </div>
        </div>
    );
};

export default IncomingCallModal;

