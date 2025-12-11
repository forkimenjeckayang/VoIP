module.exports = app => {
    var media = require('../controller/media.controller');
    var router = require("express").Router();
    const auth = require('../middleware/auth.middleware');
    router.post("/upload-files", auth, media.fileUpload);
    router.get("/download", media.downloadMedia); // Proxy download endpoint (no auth needed for downloads)
    
    app.use('/api/media', router);
};