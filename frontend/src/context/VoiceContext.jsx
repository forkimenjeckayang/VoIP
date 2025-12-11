import React, { createContext, useContext, useState, useEffect } from 'react';
import { Device } from '@twilio/voice-sdk';
import { useAuth } from './AuthContext';
import { useSocket } from './SocketContext';
import api from '../services/api';

const VoiceContext = createContext();

export const VoiceProvider = ({ children }) => {
    const [device, setDevice] = useState(null);
    const [call, setCall] = useState(null);
    const [callStatus, setCallStatus] = useState('idle'); // idle, connecting, ringing, active, ended
    const [selectedProfile, setSelectedProfile] = useState(null);
    const { user } = useAuth();
    const socket = useSocket();

    useEffect(() => {
        if (user) {
            // Auto-load profile if none selected
            if (!selectedProfile) {
                loadDefaultProfile();
            }
        }
    }, [user]);

    // Listen for profile changes via socket
    useEffect(() => {
        if (socket) {
            const handleProfileDeleted = async (data) => {
                console.log('🗑️ VoiceContext: Profile deleted', data);
                // If the deleted profile was selected, clear selection and reload
                if (selectedProfile?._id === data.profile_id) {
                    setSelectedProfile(null);
                    // Try to load a new default profile
                    try {
                        const res = await api.post('/profile/getdata');
                        if (res.data.status && res.data.data && res.data.data.length > 0) {
                            setSelectedProfile(res.data.data[0]);
                        }
                    } catch (error) {
                        console.error('VoiceContext: Failed to load default profile after deletion', error);
                    }
                }
            };

            const handleProfileCreated = async () => {
                console.log('✅ VoiceContext: Profile created');
                // If no profile is selected, try to load the new one
                if (!selectedProfile) {
                    try {
                        const res = await api.post('/profile/getdata');
                        if (res.data.status && res.data.data && res.data.data.length > 0) {
                            setSelectedProfile(res.data.data[0]);
                        }
                    } catch (error) {
                        console.error('VoiceContext: Failed to load default profile after creation', error);
                    }
                }
            };

            socket.on('profile_deleted', handleProfileDeleted);
            socket.on('profile_created', handleProfileCreated);

            return () => {
                if (socket) {
                    socket.off('profile_deleted', handleProfileDeleted);
                    socket.off('profile_created', handleProfileCreated);
                }
            };
        }
    }, [socket, selectedProfile]);

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
            const res = await api.post('/call/token', {
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
                        // Reset to idle after a brief moment to allow UI to update
                        setTimeout(() => {
                            setCallStatus('idle');
                        }, 500);
                    });

                    incomingCall.on('reject', () => {
                        setCallStatus('ended');
                        setCall(null);
                        // Reset to idle after a brief moment to allow UI to update
                        setTimeout(() => {
                            setCallStatus('idle');
                        }, 500);
                    });
                });

                await twilioDevice.register();
                setDevice(twilioDevice);
            }
        } catch (error) {
            console.error('Failed to initialize Twilio Device:', error);
        }
    };

    const makeCall = async (phoneNumber, onError) => {
        if (!selectedProfile) {
            if (onError) {
                onError('Please select a profile first. Go to Settings to select a phone number.');
            }
            return;
        }

        if (!device) {
            if (onError) {
                onError('Device not initialized. Please wait a moment and try again.');
            }
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

            // Helper function to get CallSid from the call object
            const getCallSid = () => {
                return outgoingCall.parameters?.CallSid || 
                       outgoingCall.parameters?.callSid || 
                       outgoingCall.sid || 
                       null;
            };

            // Save call to database when call is initiated
            // Use a small delay to ensure CallSid is available
            setTimeout(async () => {
                const callSid = getCallSid();
                if (callSid) {
                    try {
                        console.log('📞 Saving call record:', { callSid, phoneNumber, twilio_number: selectedProfile.phoneNumber });
                        const response = await api.post('/call/create', {
                            sid: callSid,
                            number: phoneNumber,
                            twilio_number: selectedProfile.phoneNumber,
                            type: 'send',
                            status: 'initiated'
                        });
                        console.log('✅ Call record saved:', response.data);
                    } catch (error) {
                        console.error('❌ Failed to save call record:', error.response?.data || error.message);
                    }
                } else {
                    console.warn('⚠️ CallSid not available, cannot save call record');
                }
            }, 500); // Increased delay to ensure CallSid is available

            outgoingCall.on('accept', async () => {
                setCallStatus('active');
                // Update call status to active
                const callSid = getCallSid();
                if (callSid) {
                    try {
                        await api.post('/call/update-status', {
                            sid: callSid,
                            status: 'active'
                        });
                    } catch (error) {
                        // Silently fail - don't break the call flow
                        if (error.response?.status !== 404) {
                            console.error('Failed to update call status:', error);
                        }
                    }
                }
            });

            outgoingCall.on('disconnect', async () => {
                setCallStatus('ended');
                // Update call status and duration
                const callSid = getCallSid();
                if (callSid) {
                    try {
                        const duration = outgoingCall.parameters?.CallDuration || 
                                        outgoingCall.parameters?.callDuration || 0;
                        await api.post('/call/update-status', {
                            sid: callSid,
                            status: 'completed',
                            duration: parseInt(duration) || 0
                        });
                    } catch (error) {
                        // Silently fail - don't break the call flow if status update fails
                        // The call record was already created, status update is just for accuracy
                        if (error.response?.status !== 404) {
                            console.error('Failed to update call status:', error);
                        }
                    }
                }
                setCall(null);
                // Reset to idle after a brief moment to allow UI to update
                setTimeout(() => {
                    setCallStatus('idle');
                }, 500);
            });

            outgoingCall.on('reject', async () => {
                setCallStatus('ended');
                // Update call status to rejected
                const callSid = getCallSid();
                if (callSid) {
                    try {
                        await api.post('/call/update-status', {
                            sid: callSid,
                            status: 'rejected'
                        });
                    } catch (error) {
                        // Silently fail - don't break the call flow
                        if (error.response?.status !== 404) {
                            console.error('Failed to update call status:', error);
                        }
                    }
                }
                setCall(null);
                // Reset to idle after a brief moment to allow UI to update
                setTimeout(() => {
                    setCallStatus('idle');
                }, 500);
            });

            outgoingCall.on('cancel', async () => {
                // Update call status to canceled
                const callSid = getCallSid();
                if (callSid) {
                    try {
                        await api.post('/call/update-status', {
                            sid: callSid,
                            status: 'canceled'
                        });
                    } catch (error) {
                        // Silently fail - don't break the call flow
                        if (error.response?.status !== 404) {
                            console.error('Failed to update call status:', error);
                        }
                    }
                }
            });

            // Handle call errors (including timeout/no-answer - error 31000)
            outgoingCall.on('error', async (error) => {
                console.error('Call error:', error);
                setCallStatus('ended');
                
                // Update call status based on error code
                const callSid = getCallSid();
                if (callSid) {
                    try {
                        let status = 'failed';
                        // Error 31000 = "Call is no longer valid" (usually timeout/no-answer)
                        if (error.code === 31000 || error.message?.includes('no longer valid') || error.message?.includes('UnknownError')) {
                            status = 'no-answer';
                        }
                        
                        await api.post('/call/update-status', {
                            sid: callSid,
                            status: status
                        });
                    } catch (updateError) {
                        // Silently fail - don't break the call flow
                        if (updateError.response?.status !== 404) {
                            console.error('Failed to update call status:', updateError);
                        }
                    }
                }
                
                setCall(null);
                // Reset to idle after a brief moment
                setTimeout(() => {
                    setCallStatus('idle');
                }, 500);
            });

        } catch (error) {
            console.error('Failed to make call:', error);
            setCallStatus('idle');
            if (onError) {
                onError('Failed to make call: ' + (error.message || 'Unknown error'));
            }
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
