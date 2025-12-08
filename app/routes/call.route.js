module.exports = app => {
    var call = require('../controller/call.controller');
    var router = require("express").Router();
    const auth = require('../middleware/auth.middleware');

    router.post("/setting", auth, call.create);
    router.post("/setting/delete", auth, call.delete);
    router.post("/setting/get", auth, call.get);
    router.post("/token", auth, call.getToken);

    //calling route - Twilio-only
    router.post("/make-call", call.makeCall);
    router.post("/status", call.status);
    router.post("/incomming", call.incomming);
    
    app.use('/api/call', router);
};