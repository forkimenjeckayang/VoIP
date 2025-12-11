const Validator = require('validatorjs');
var mongoose = require('mongoose');
var Setting = require('../model/setting.model');
var Call = require('../model/message.model');
var Contact = require('../model/contact.model');
var twilio = require('twilio');

exports.create = async (req, res) => {
    try {
        let rules = {
            type: 'required'
        };
        let validation = new Validator(req.body, rules);
        if (validation.passes()) {
            // var checkSetting = await Setting.findById(req.body.setting_id)
            var checkSetting = await Setting.findOne({ _id: { $eq: req.body.setting_id } })
            if (checkSetting) {
                // Twilio-only: Update call settings
                checkSetting.app_key = req.body.app_key
                checkSetting.app_secret = req.body.app_secret
                checkSetting.twiml_app = req.body.twiml_app
                var saveData = await checkSetting.save()
                if (saveData) {
                    res.send({ status: true, message: 'call setting updated!', data: checkSetting });
                } else {
                    res.status(400).json({ status: 'false', message: 'call setting not updated!' });
                }
            }
        } else {
            res.status(419).send({ status: false, errors: validation.errors, data: [] });
        }
    } catch (error) {
        res.status(400).json({ status: 'false', message: 'something went wrong' });
    }
};

exports.delete = async (req, res) => {
    try {
        var checkSetting = await Setting.findOne({ _id: { $eq: req.body.setting_id } })
        if (checkSetting) {
            checkSetting.app_key = null
            checkSetting.app_secret = null
            checkSetting.twiml_app = null
            var saveData = await checkSetting.save()
            if (saveData) {
                res.send({ status: true, message: 'Call setting deleted!', data: checkSetting });
            } else {
                res.status(400).json({ status: 'false', message: 'Call setting not deleted!' });
            }
        } else {
            res.status(404).json({ status: 'false', message: 'Setting not found!' });
        }
    } catch (error) {
        console.error('Delete call setting error:', error);
        res.status(400).json({ status: 'false', message: 'something went wrong' });
    }
};
exports.get = async (req, res) => {
    try {
        var checkSetting = await Setting.findOne({ _id: { $eq: req.body.setting_id } })
        res.send({ status: true, message: 'get Call setting!', data: checkSetting });
    } catch (error) {
        res.status(400).json({ status: 'false', message: 'something went wrong' });
    }
};

exports.getCallHistory = async (req, res) => {
    try {
        const userId = req.user?.id || req.body.user;
        if (!userId) {
            return res.status(400).json({ status: false, message: 'User ID required', data: [] });
        }

        // Convert userId to ObjectId if it's a string (to match database format)
        let userObjectId;
        try {
            userObjectId = mongoose.Types.ObjectId.isValid(userId) 
                ? new mongoose.Types.ObjectId(userId) 
                : userId;
        } catch (error) {
            userObjectId = userId;
        }

        // Get all calls for the user, filter by datatype: 'call'
        // Try both ObjectId and string formats to catch all calls
        var calls = await Call.find({
            $or: [
                { user: userObjectId },
                { user: userId }
            ],
            datatype: { $eq: 'call' }
        })
        .populate('contact')
        .populate('setting')
        .sort({ created_at: -1 })
        .limit(100); // Limit to last 100 calls

        console.log(`Found ${calls.length} calls for user ${userId}`);

        // Format calls with receivingProfileName
        const formattedCalls = calls.map(call => ({
            ...call.toObject(),
            receivingProfileName: call.setting?.profile || call.twilio_number
        }));

        res.send({ status: true, message: 'Call history retrieved!', data: formattedCalls });
    } catch (error) {
        console.error('Get call history error:', error);
        res.status(400).json({ status: false, message: 'something went wrong', data: [] });
    }
}

exports.deleteCall = async (req, res) => {
    try {
        const callId = req.body.call_id;
        const userId = req.user?.id || req.body.user;

        if (!callId) {
            return res.status(400).json({ status: false, message: 'Call ID required' });
        }

        if (!userId) {
            return res.status(400).json({ status: false, message: 'User ID required' });
        }

        // Convert userId to ObjectId if needed
        let userObjectId;
        try {
            userObjectId = mongoose.Types.ObjectId.isValid(userId) 
                ? new mongoose.Types.ObjectId(userId) 
                : userId;
        } catch (error) {
            userObjectId = userId;
        }

        // Find and delete the call, ensuring it belongs to the user
        const call = await Call.findOne({
            _id: callId,
            $or: [
                { user: userObjectId },
                { user: userId }
            ],
            datatype: 'call'
        });

        if (!call) {
            return res.status(404).json({ status: false, message: 'Call not found' });
        }

        await Call.deleteOne({ _id: callId });
        res.send({ status: true, message: 'Call deleted successfully!' });
    } catch (error) {
        console.error('Delete call error:', error);
        res.status(400).json({ status: false, message: 'Failed to delete call' });
    }
}

exports.deleteAllCalls = async (req, res) => {
    try {
        const userId = req.user?.id || req.body.user;

        if (!userId) {
            return res.status(400).json({ status: false, message: 'User ID required' });
        }

        // Convert userId to ObjectId if needed
        let userObjectId;
        try {
            userObjectId = mongoose.Types.ObjectId.isValid(userId) 
                ? new mongoose.Types.ObjectId(userId) 
                : userId;
        } catch (error) {
            userObjectId = userId;
        }

        // Delete all calls for the user
        const result = await Call.deleteMany({
            $or: [
                { user: userObjectId },
                { user: userId }
            ],
            datatype: 'call'
        });

        res.send({ 
            status: true, 
            message: `Deleted ${result.deletedCount} call(s) successfully!`,
            deletedCount: result.deletedCount
        });
    } catch (error) {
        console.error('Delete all calls error:', error);
        res.status(400).json({ status: false, message: 'Failed to delete calls' });
    }
};

exports.createCall = async (req, res) => {
    try {
        const userId = req.user?.id || req.body.user;
        const { sid, number, twilio_number, type, status } = req.body;

        if (!userId || !sid || !number) {
            return res.status(400).json({ 
                status: false, 
                message: 'User ID, Call SID, and number are required' 
            });
        }

        // Convert userId to ObjectId if needed
        let userObjectId;
        try {
            userObjectId = mongoose.Types.ObjectId.isValid(userId) 
                ? new mongoose.Types.ObjectId(userId) 
                : userId;
        } catch (error) {
            userObjectId = userId;
        }

        // Find the setting/profile for this twilio_number
        const setting = await Setting.findOne({ 
            number: { $eq: twilio_number },
            $or: [
                { user: userObjectId },
                { user: userId }
            ]
        });

        if (!setting) {
            return res.status(404).json({ 
                status: false, 
                message: 'Setting/profile not found for this number' 
            });
        }

        // Check if call already exists
        let call = await Call.findOne({ sid: { $eq: sid } });
        
        if (call) {
            // Update existing call
            call.status = status || call.status;
            await call.save();
            return res.status(200).json({ 
                status: true, 
                message: 'Call updated', 
                data: call 
            });
        }

        // Find contact if exists
        let contact = null;
        if (number) {
            contact = await Contact.findOne({ 
                $or: [
                    { user: userObjectId },
                    { user: userId }
                ],
                number: { $eq: number } 
            });
        }

        // Create new call record
        const callData = {
            sid: sid,
            user: userObjectId, // Use ObjectId format for consistency
            datatype: 'call',
            type: type || 'send',
            number: number,
            twilio_number: twilio_number,
            setting: setting._id,
            status: status || 'initiated',
            isview: 'true',
            contact: contact?._id
        };

        console.log('📞 Creating call record:', {
            sid,
            user: userObjectId.toString(),
            number,
            twilio_number,
            datatype: 'call',
            type: callData.type
        });

        call = await Call.create(callData);
        
        console.log('✅ Call record created successfully:', {
            _id: call._id,
            sid: call.sid,
            user: call.user?.toString(),
            number: call.number,
            datatype: call.datatype
        });

        res.status(200).json({ 
            status: true, 
            message: 'Call created', 
            data: call 
        });
    } catch (error) {
        console.error('createCall error:', error);
        res.status(500).json({ 
            status: false, 
            message: 'Failed to create call record' 
        });
    }
};

exports.updateCallStatus = async (req, res) => {
    try {
        const { sid, status, duration } = req.body;

        if (!sid) {
            return res.status(400).json({ 
                status: false, 
                message: 'Call SID is required' 
            });
        }

        const call = await Call.findOne({ sid: { $eq: sid } });
        
        if (!call) {
            return res.status(404).json({ 
                status: false, 
                message: 'Call not found' 
            });
        }

        if (status) call.status = status;
        if (duration !== undefined) call.duration = duration;
        
        await call.save();

        res.status(200).json({ 
            status: true, 
            message: 'Call status updated', 
            data: call 
        });
    } catch (error) {
        console.error('updateCallStatus error:', error);
        res.status(500).json({ 
            status: false, 
            message: 'Failed to update call status' 
        });
    }
};

exports.getToken = async (req, res) => {
    try {
        var setting = await Setting.findOne({ _id: { $eq: req.body.setting_id } })
        if (setting) {
            // Validate required fields
            if (!setting.app_key || !setting.app_secret || !setting.twiml_app) {
                return res.status(400).send({ 
                    status: false, 
                    error: true, 
                    message: 'Setting is missing required Twilio credentials (app_key, app_secret, or twiml_app)', 
                    data: [] 
                });
            }

            // SaaS: Generate access token for voice calls using Master Account and User Specific API Key
            const AccessToken = twilio.jwt.AccessToken;
            const VoiceGrant = AccessToken.VoiceGrant;

            const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
            const twilioApiKey = setting.app_key;
            const twilioApiSecret = setting.app_secret;
            const outgoingApplicationSid = setting.twiml_app;
            const identity = req.user.id;

            if (!twilioAccountSid) {
                return res.status(500).send({ 
                    status: false, 
                    error: true, 
                    message: 'TWILIO_ACCOUNT_SID not configured', 
                    data: [] 
                });
            }

            const voiceGrant = new VoiceGrant({
                outgoingApplicationSid: outgoingApplicationSid,
                incomingAllow: true, // Allow incoming calls
            });
            // Create token with 24 hour expiration (max allowed by Twilio)
            // This prevents token expiration during long sessions
            const token = new AccessToken(
                twilioAccountSid,
                twilioApiKey,
                twilioApiSecret,
                { 
                    identity: identity,
                    ttl: 86400 // 24 hours in seconds (max allowed)
                }
            );
            token.addGrant(voiceGrant);
            var tokenData = token.toJwt()
            res.send({ status: true, message: 'get token!', data: { token: tokenData, type: 'twilio' } });
        } else {
            res.status(404).send({ status: false, error: true, message: 'Setting not found!', data: [] });
        }
    } catch (error) {
        console.error('getToken error:', error);
        res.status(500).send({ status: false, error: true, errorData: 'something wrong in get token!', data: [] });
    }
};

exports.makeCall = async (req, res) => {
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const response = new VoiceResponse();
    try {
        // When using Device SDK, Twilio sends 'To' parameter, not 'number'
        // For Device SDK, 'From' is in format 'client:USER_ID', not a phone number
        const phoneNumberToCall = req.body.To || req.body.number;
        const fromParam = req.body.From || req.body.twilio_number;
        
        if (!phoneNumberToCall) {
            console.error('makeCall: No phone number (To) provided in request');
            res.set('Content-Type', 'text/xml');
            return res.send(response.toString());
        }

        // Check if From is a client identity (Device SDK) or a phone number
        let checkSetting = null;
        let twilioNumber = null;
        
        if (fromParam && fromParam.startsWith('client:')) {
            // Device SDK: Extract user ID from client identity
            const userId = fromParam.replace('client:', '');
            // Find the active setting for this user
            checkSetting = await Setting.findOne({ user: { $eq: userId } });
            if (checkSetting) {
                twilioNumber = checkSetting.number;
            }
        } else {
            // Legacy: From is a phone number
            twilioNumber = fromParam;
            checkSetting = await Setting.findOne({ number: { $eq: twilioNumber } });
        }
        
        if (checkSetting && twilioNumber) {
            // Increase timeout to 60 seconds (default is 30, max is 60)
            const { combineURLs } = require('../helper/common.helper');
            var dial = response.dial({
                callerId: twilioNumber,
                timeout: 60, // Maximum timeout: 60 seconds (increased from default 30)
                action: combineURLs(process.env.BASE_URL.trim(), 'api/call/status'),
                method: 'POST'
            });

            // Format phone number
            var phoneNumber = phoneNumberToCall.trim().replace("+", "")
            var stringLen = phoneNumber.length
            if (stringLen > 10) {
                phoneNumber = `+${phoneNumber}`
            } else if (stringLen == 10) {
                phoneNumber = `+1${phoneNumber}`
            }
            
            // Only create call record if CallSid is provided (webhook call)
            if (req.body.CallSid) {
                var updateCall = {
                    sid: req.body.CallSid,
                    user: checkSetting.user,
                    datatype: 'call',
                    type: 'send',
                    number: phoneNumber,
                    twilio_number: twilioNumber,
                    setting: checkSetting._id,
                    isview: 'true'
                }
                var contact = await Contact.findOne({ user: { $eq: checkSetting.user }, number: { $eq: phoneNumber } });
                if (contact) {
                    updateCall.contact = contact._id
                }
                await Call.create(updateCall);
            }
            
            dial.number(phoneNumber);
            res.set('Content-Type', 'text/xml');
            return res.send(response.toString());
        } else {
            console.error('makeCall: Setting not found. From:', fromParam, 'To:', phoneNumberToCall);
            res.set('Content-Type', 'text/xml');
            return res.send(response.toString());
        }
    } catch (error) {
        console.error('makeCall error:', error);
        res.set('Content-Type', 'text/xml');
        return res.send(response.toString());
    }
};

exports.status = async (req, res) => {
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const response = new VoiceResponse();
    try {
        var call = await Call.findOne({ sid: { $eq: req.body.CallSid } })
        if (call) {
            call.duration = req.body.CallDuration
            call.status = req.body.CallStatus
            await call.save()
            var settingCheck = await Setting.findOne({ number: { $eq: call.twilio_number } })
            if (settingCheck && global.io) {
                global.io.to(settingCheck.user.toString()).emit('user_message', { 
                    message: 'call', 
                    number: call.number,
                    status: call.status,
                    duration: call.duration
                });
            }
        }
    } catch (error) {
        console.error('Call status update error:', error);
    }
    res.set('Content-Type', 'text/xml');
    res.send(response.toString());
};
exports.incomming = async (req, res) => {
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const response = new VoiceResponse();
    try {
        var settingCheck = await Setting.findOne({ number: { $eq: req.body.To } })
        if (settingCheck) {
            const dial = response.dial();
            const client = dial.client();
            client.identity(`${settingCheck.user}`);
            var updateCall = {
                sid: req.body.CallSid,
                user: settingCheck.user,
                datatype: 'call',
                type: 'receive',
                number: req.body.From,
                twilio_number: req.body.To,
                setting: settingCheck._id,
                isview: 'false'
            }
            var contact = await Contact.findOne({ user: { $eq: settingCheck.user }, number: { $eq: req.body.From } });
            if (contact) {
                updateCall.contact = contact._id
            }
            await Call.create(updateCall);
        } else {
            console.error('incomming: Setting not found for number:', req.body.To);
        }
    } catch (error) {
        console.error('Incoming call error:', error);
    }
    res.set('Content-Type', 'text/xml');
    res.send(response.toString());
};
