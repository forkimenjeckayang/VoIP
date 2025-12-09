import React, { createContext, useContext, useState, useEffect } from 'react';
import { Device } from '@twilio/voice-sdk';
import { useAuth } from './AuthContext';
import api from '../services/api';

const VoiceContext = createContext();

export const VoiceProvider = ({ children }) => {
    const [device, setDevice] = useState(null);
    const [call, setCall] = useState(null);
    const [callStatus, setCallStatus] = useState('idle'); // idle, connecting, ringing, active, ended
    const [selectedProfile, setSelectedProfile] = useState(null);
    const { user } = useAuth();

    useEffect(() => {
        if (user) {
            // Auto-load profile if none selected
            if (!selectedProfile) {
                loadDefaultProfile();
            }
        }
    }, [user]);

    useEffect(() => {
        if (user && selectedProfile) {
            initializeDevice();
        }

        return () => {
            if (device) {
                device.destroy();
            }
        };
    }, [user, selectedProfile]);

    const loadDefaultProfile = async () => {
        try {
            const res = await api.post('/profile/getdata');
            if (res.data.status && res.data.data && res.data.data.length > 0) {
                console.log('VoiceContext: Auto-selecting profile', res.data.data[0]);
                setSelectedProfile(res.data.data[0]);
            }
        } catch (error) {
            console.error('VoiceContext: Failed to load default profile', error);
        }
    };

    const initializeDevice = async () => {
        try {
            // Get access token from backend
            const res = await api.post('/call/get-token', {
                setting_id: selectedProfile._id
            });

            if (res.data.status) {
                const token = res.data.data.token;

                // Create Twilio Device
                const twilioDevice = new Device(token, {
                    logLevel: 1,
                    codecPreferences: ['opus', 'pcmu']
                });

                // Setup event listeners
                twilioDevice.on('registered', () => {
                    console.log('Twilio Device registered');
                });

                twilioDevice.on('error', (error) => {
                    console.error('Twilio Device error:', error);
                    setCallStatus('error');
                });

                twilioDevice.on('incoming', (incomingCall) => {
                    console.log('Incoming call from:', incomingCall.parameters.From);
                    setCall(incomingCall);
                    setCallStatus('ringing');

                    incomingCall.on('accept', () => {
                        setCallStatus('active');
                    });

                    incomingCall.on('disconnect', () => {
                        setCallStatus('ended');
                        setCall(null);
                    });

                    incomingCall.on('reject', () => {
                        setCallStatus('ended');
                        setCall(null);
                    });
                });

                await twilioDevice.register();
                setDevice(twilioDevice);
            }
        } catch (error) {
            console.error('Failed to initialize Twilio Device:', error);
        }
    };

    const makeCall = async (phoneNumber) => {
        if (!device || !selectedProfile) {
            alert('Please select a profile first');
            return;
        }

        try {
            setCallStatus('connecting');

            const outgoingCall = await device.connect({
                params: {
                    To: phoneNumber,
                    twilio_number: selectedProfile.phoneNumber
                }
            });

            setCall(outgoingCall);

            outgoingCall.on('accept', () => {
                setCallStatus('active');
            });

            outgoingCall.on('disconnect', () => {
                setCallStatus('ended');
                setCall(null);
            });

            outgoingCall.on('reject', () => {
                setCallStatus('ended');
                setCall(null);
            });

        } catch (error) {
            console.error('Failed to make call:', error);
            setCallStatus('idle');
            alert('Failed to make call: ' + error.message);
        }
    };

    const hangup = () => {
        if (call) {
            call.disconnect();
            setCall(null);
            setCallStatus('idle');
        }
    };

    const acceptCall = () => {
        if (call) {
            call.accept();
        }
    };

    const rejectCall = () => {
        if (call) {
            call.reject();
            setCall(null);
            setCallStatus('idle');
        }
    };

    const toggleMute = () => {
        if (call) {
            const isMuted = call.isMuted();
            call.mute(!isMuted);
            return !isMuted;
        }
        return false;
    };

    return (
        <VoiceContext.Provider value={{
            device,
            call,
            callStatus,
            selectedProfile,
            setSelectedProfile,
            makeCall,
            hangup,
            acceptCall,
            rejectCall,
            toggleMute
        }}>
            {children}
        </VoiceContext.Provider>
    );
};

export const useVoice = () => useContext(VoiceContext);
