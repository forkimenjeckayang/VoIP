const Validator = require('validatorjs');
var Setting = require('../model/setting.model');

const twilio = require('twilio');
const twilioHelper = require('../helper/twilio.helper');
const { combineURLs } = require('../helper/common.helper')

exports.twilioTwimlFallback = async (req, res) => {
    try {
        let rules = {
            url: 'required',
            setting_id: 'required'
        };
        let validation = new Validator(req.body, rules);
        if (validation.passes()) {
            // var checkSetting = await Setting.findById(req.body.setting_id)
            var checkSetting = await Setting.findOne({ _id: { $eq: req.body.setting_id } })
            if (checkSetting) {
                var updateData = {
                    sid: checkSetting.twilio_sid,
                    token: checkSetting.twilio_token,
                    twimlsid: checkSetting.twiml_app,
                    url: combineURLs(req.body.url, '/api/call/make-call')
                }
                await twilioHelper.twimlFallbackUpdate(updateData);

                var updateData2 = {
                    sid: checkSetting.twilio_sid,
                    token: checkSetting.twilio_token,
                    numbersid: checkSetting.sid,
                    voice_url: combineURLs(req.body.url, '/api/call/incomming'),
                    sms_url: combineURLs(req.body.url, '/api/setting/receive-sms/twilio)')
                }
                await twilioHelper.numberFallbackUpdate(updateData2);

                res.send({ status: true, message: 'Fallback url updated!', data: checkSetting });
            } else {
                res.status(400).send({ status: false, message: 'Setting not found', data: [] });
            }
        } else {
            res.status(419).send({ status: false, errors: validation.errors, data: [] });
        }
    } catch (error) {
        res.status(400).json({ status: 'false', message: 'something is wrong' });
    }
};

exports.twilioNumberFallback = async (req, res) => {
    try {
        let rules = {
            setting_id: 'required',
            voice_url: 'required',
            sms_url: 'required'
        };
        let validation = new Validator(req.body, rules);
        if (validation.passes()) {
            // var checkSetting = await Setting.findById(req.body.setting_id)
            var checkSetting = await Setting.findOne({ _id: { $eq: req.body.setting_id } })
            if (checkSetting) {
                var updateData = {
                    sid: checkSetting.twilio_sid,
                    token: checkSetting.twilio_token,
                    numbersid: checkSetting.sid,
                    voice_url: req.body.voice_url,
                    sms_url: req.body.sms_url
                }
                await twilioHelper.numberFallbackUpdate(updateData);
                res.send({ status: true, message: 'Fallback url updated!', data: checkSetting });
            } else {
                res.status(400).send({ status: false, message: 'Setting not found', data: [] });
            }
        } else {
            res.status(419).send({ status: false, errors: validation.errors, data: [] });
        }
    } catch (error) {
        res.status(400).json({ status: 'false', message: 'something is wrong' });
    }
};

exports.twilioTwimlGet = async (req, res) => {
    try {
        let rules = {
            setting_id: 'required'
        };
        let validation = new Validator(req.body, rules);
        if (validation.passes()) {
            // var checkSetting = await Setting.findById(req.body.setting_id)
            var checkSetting = await Setting.findOne({ _id: { $eq: req.body.setting_id } })
            if (checkSetting) {
                var updateData = {
                    sid: checkSetting.twilio_sid,
                    token: checkSetting.twilio_token,
                    twimlsid: checkSetting.twiml_app,
                }
                var app = await twilioHelper.twimlGet(updateData);
                res.send({ status: true, message: 'Fallback url updated!', data: app });
            } else {
                res.status(400).send({ status: false, message: 'Setting not found', data: [] });
            }
        } else {
            res.status(419).send({ status: false, errors: validation.errors, data: [] });
        }
    } catch (error) {
        res.status(400).json({ status: 'false', message: 'something is wrong' });
    }
};

exports.twilioNumberGet = async (req, res) => {
    try {
        let rules = {
            setting_id: 'required',
        };
        let validation = new Validator(req.body, rules);
        if (validation.passes()) {
            // var checkSetting = await Setting.findById(req.body.setting_id)
            var checkSetting = await Setting.findOne({ _id: { $eq: req.body.setting_id } })
            if (checkSetting) {
                var updateData = {
                    sid: checkSetting.twilio_sid,
                    token: checkSetting.twilio_token,
                    numbersid: checkSetting.sid
                }
                var number = await twilioHelper.numberGet(updateData);
                res.send({ status: true, message: 'Number setting!', data: number });
            } else {
                res.status(400).send({ status: false, message: 'Setting not found', data: [] });
            }
        } else {
            res.status(419).send({ status: false, errors: validation.errors, data: [] });
        }
    } catch (error) {
        res.status(400).json({ status: 'false', message: 'something is wrong' });
    }
};



exports.checkCallSetting = async (req, res) => {
    try {
        var rules = {
            twilio_sid: 'required',
            twilio_token: 'required',
            twilio_number: 'required',
            sid: 'required',
        }
        let validation = new Validator(req.body, rules);
        if (validation.passes()) {
            var updateData = {
                sid: req.body.twilio_sid,
                token: req.body.twilio_token,
                numbersid: req.body.sid
            }
            var numberData = await twilioHelper.numberGet(updateData);
            res.send({ status: 'true', message: 'Number Data!', data: numberData });
        } else {
            res.status(400).send({ status: false, message: 'Please enter valid data', data: [] });
        }
    } catch (error) {
        res.status(400).json({ status: 'false', message: 'something is wrong' });
    }
};

