module.exports = app => {
    var setting = require('../controller/setting.controller');
    var fallback = require('../controller/fallback.controller');
    var router = require("express").Router();
    const auth = require('../middleware/auth.middleware');
    router.post("/create", auth, setting.create);
    router.post("/get-number", setting.getNumber);
    router.post("/get-setting", auth, setting.getSetting);
    router.post("/get-balance", auth, setting.getBalance);
    router.post("/receive-sms/:type", setting.receiveSms);
    router.post("/sms-status/:type", setting.smsStatus);
    router.post("/delete-key", auth, setting.deleteKey);
    //sms route
    router.post("/send-sms", auth, setting.sendSms);
    router.post("/sms-number-list", auth, setting.getNumberList);
    router.post("/message-list", auth, setting.messageList);
    router.post("/message-list-delete", auth, setting.messageDelete);
    router.post("/message-delete", auth, setting.deleteSingleMessage);
    router.post("/get-stats", auth, setting.getStats);

    // Twilio-only fallback routes
    router.post("/twilio/twiml/fallback", auth, fallback.twilioTwimlFallback);
    router.post("/twilio/number/fallback", auth, fallback.twilioNumberFallback);
    router.post("/twilio/twiml/get", auth, fallback.twilioTwimlGet);
    router.post("/twilio/number/get", auth, fallback.twilioNumberGet);

    router.post("/check-setting", auth, fallback.checkCallSetting);

    app.use('/api/setting', router);
};