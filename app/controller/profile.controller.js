const Validator = require('validatorjs');
var Setting = require('../model/setting.model');
var Message = require('../model/message.model');
const twilio = require('twilio');

const twilioHelper = require('../helper/twilio.helper')
exports.crateProfile = async (req, res) => {
    try {
        let rules = {
            profile: 'required'
        };
        let validation = new Validator(req.body, rules);
        if (validation.passes()) {
            var checkprofile = { user: { $eq: req.user.id }, profile: { $eq: req.body.profile } };
            var checkProfileData = await Setting.findOne(checkprofile)
            if (checkProfileData) {
                res.status(400).json({ status: 'false', message: 'Profile already exists!' });
            } else {
                var storeData = { user: req.user.id, profile: req.body.profile };
                var isSave = await Setting.create(storeData);
                if (isSave) {
                    res.send({ status: true, message: 'Profile saved!', data: isSave });
                } else {
                    res.status(400).json({ status: 'false', message: 'Profile not saved!' });
                }
            }

        } else {
            res.status(419).send({ status: false, errors: validation.errors, data: [] });
        }
    } catch (error) {
        res.status(400).json({ status: 'false', message: 'something is wrong' });
    }
};

exports.getOneProfile = async (req, res) => {
    try {
        var getData = await Setting.findOne({ user: { $eq: req.user.id }, _id: { $eq: req.body.setting } }).populate({
            path: 'messageCount',
            match: { isview: 'false' }
        }).populate({
            path: 'totalCount',
            match: { isview: 'false' }
        })
        // var messageCount = await Message.countDocuments({user:req.user.id,isview:'false'})
        // getData.totalMessage = messageCount;
        res.send({ status: true, message: 'Profile data!', data: getData });
    } catch (error) {
        res.status(400).json({ status: 'false', message: 'something is wrong' });
    }
};
exports.getProfile = async (req, res) => {
    try {
        var getData = await Setting.find({ user: { $eq: req.user.id } }).populate({
            path: 'messageCount',
            match: { isview: 'false' }
        }).populate({
            path: 'totalCount',
            match: { isview: 'false' }
        });

        // Enrich with phone numbers from Twilio
        const enrichedData = await Promise.all(getData.map(async (setting) => {
            const settingObj = setting.toObject();
            if (setting.sid) {
                try {
                    const twilioNumber = await twilioHelper.numberGet({ numbersid: setting.sid });
                    if (twilioNumber) {
                        settingObj.phoneNumber = twilioNumber.phoneNumber;
                        settingObj.friendlyName = twilioNumber.friendlyName;
                        settingObj.country = twilioNumber.isoCountry;
                    }
                } catch (error) {
                    console.error('Failed to fetch Twilio number:', error);
                }
            }
            return settingObj;
        }));

        res.send({ status: true, message: 'Profile data!', data: enrichedData });
    } catch (error) {
        res.status(400).json({ status: 'false', message: 'something is wrong' });
    }
};
exports.deleteProfile = async (req, res) => {
    try {
        var settingCheck = await Setting.findOne({ _id: { $eq: req.body.profile_id } })

        if (settingCheck) {
            await Message.deleteMany({ setting: settingCheck._id })

            // SaaS Cleanup Resources
            if (settingCheck.app_key) {
                try {
                    await twilioHelper.removeAPIKey(settingCheck.app_key)
                } catch (error) { }
            }
            if (settingCheck.sid) {
                try {
                    await twilioHelper.unlinkNumber(settingCheck.sid)
                } catch (error) { }
            }

            await Setting.deleteOne({ _id: { $eq: req.body.profile_id } })
            res.send({ status: true, message: 'Profile deleted and number released successfully!', data: settingCheck });
        } else {
            res.status(400).json({ status: 'false', message: 'Profile not found!' });
        }
    } catch (error) {
        res.status(400).json({ status: 'false', message: 'something is wrong' });
    }
};

exports.updateProfile = async (req, res) => {
    try {
        let rules = {
            profile: 'required',
            profile_id: 'required'
        };
        let validation = new Validator(req.body, rules);
        if (validation.passes()) {
            // var setting = await Setting.findById(req.body.profile_id)
            var setting = await Setting.findOne({ _id: { $eq: req.body.profile_id } })
            setting.profile = req.body.profile;
            var save = setting.save();
            if (save) {
                res.send({ status: true, message: 'Profile update successfully!', data: setting });
            } else {
                res.status(400).json({ status: 'false', message: 'Profile not updated!' });
            }
        } else {
            res.status(419).send({ status: false, errors: validation.errors, data: [] });
        }
    } catch (error) {
        res.status(400).json({ status: 'false', message: 'something is wrong' });
    }
};

