var Media = require('../model/media.model');
const multer = require("multer")
const path = require("path")
const crypto = require('crypto')
const moment = require('moment')
const fs = require("fs")
const { combineURLs } = require("../helper/common.helper")

var storage = multer.diskStorage({
    destination: async function (req, file, cb) {
        var date = moment(new Date()).format('MMDDYYYY');
        try {
            await fs.promises.access("./uploads/" + date);
        } catch (e) {
            await fs.promises.mkdir('./uploads/' + date)
        }
        // Uploads is the Upload_folder_name
        cb(null, `./uploads/${date}/`)
        // cb(null, combineURLs(__dirname, '../../../uploads/'));
    },
    filename: function (req, file, cb) {
        let ext = path.extname(file.originalname).toLowerCase();
        var filename = crypto.randomBytes(24).toString('hex');
        cb(null, filename + ext);
        // cb(null, new Date().toISOString().replace(/:/g, '-')+".jpg")
    }
})

const maxSize = 1000 * 1000 * 1000;

var upload = multer({
    storage: storage,
    limits: { fileSize: maxSize },
    fileFilter: function (req, file, cb) {
        // Accept all media types: images, videos, audio, documents
        // This preserves the original format when sending
        var allowedMimeTypes = /image|video|audio|application/;
        var mimetype = allowedMimeTypes.test(file.mimetype);

        if (mimetype) {
            return cb(null, true);
        }

        cb("Error: File upload only supports media files (images, videos, audio, documents)");
    }

    // mypic is the name of file attribute
}).single("file");


exports.fileUpload = async (req, res) => {
    try {
        upload(req, res, async function (err) {
            if (err) {
                res.send(err)
            }
            else {
                var date = moment(new Date()).format('MMDDYYYY');
                var mediaData = { media: `uploads/${date}/${req.file.filename}`, user: req.user.id };

                var media = await Media.create(mediaData);
                if (media) {
                    media.media = combineURLs(
                        process.env.BASE_URL.trim(),
                        media.media
                    );
                    res.send({ status: true, message: 'Media upload!', data: media });
                } else {
                    res.status(400).json({ status: 'false', message: 'Media not uploaded!' });
                }
            }
        })
    } catch (error) {
        res.status(400).json({ status: 'false', message: 'something is wrong' });
    }
};

var cron = require('node-cron');
// cron job runs every day at 01:00
if (process.env.NODE_ENV !== 'test') {
    cron.schedule('0 1 * * *', () => {
        console.log('running a cron job daily at 01:00 to delete mms folder older than 7 days');
        var startdate = moment();
        startdate = startdate.subtract(7, "days");
        startdate = startdate.format("DDMMYYYY");
        try {
            fs.rmdirSync("./uploads/" + startdate, { recursive: true });
        } catch (e) {
            console.log('folder not found')
        }
    });
}
exports.deleteMedia = async (req, res) => {
    try {
        var startdate = moment();
        startdate = startdate.subtract(7, "days");
        startdate = startdate.format("DDMMYYYY");
        try {
            fs.rmdirSync("./uploads/" + startdate, { recursive: true });
        } catch (e) {
            console.log('folder not found')
        }
    } catch (error) {
        res.status(400).json({ status: 'false', message: 'something is wrong' });
    }
};

// Proxy download endpoint to bypass CORS issues
exports.downloadMedia = async (req, res) => {
    try {
        const { url } = req.query;
        
        if (!url) {
            return res.status(400).json({ status: false, message: 'URL parameter is required' });
        }

        // Extract file path from URL
        let filePath;
        try {
            const urlObj = new URL(url);
            // If URL contains /uploads/, extract the path after it
            const uploadsIndex = urlObj.pathname.indexOf('/uploads/');
            if (uploadsIndex !== -1) {
                filePath = urlObj.pathname.substring(uploadsIndex + 1); // Remove leading '/'
            } else {
                filePath = urlObj.pathname;
            }
        } catch (e) {
            // If URL parsing fails, assume it's already a relative path
            filePath = url.startsWith('/') ? url.substring(1) : url;
        }

        // Construct full file path
        const fullPath = path.join(__dirname, '../../', filePath);

        // Check if file exists
        if (!fs.existsSync(fullPath)) {
            return res.status(404).json({ status: false, message: 'File not found' });
        }

        // Get filename from path
        const filename = path.basename(filePath);

        // Set headers for download
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        // Determine content type
        const ext = path.extname(filename).toLowerCase();
        const mimeTypes = {
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.gif': 'image/gif',
            '.webp': 'image/webp',
            '.mp4': 'video/mp4',
            '.webm': 'video/webm',
            '.mp3': 'audio/mpeg',
            '.wav': 'audio/wav',
            '.pdf': 'application/pdf',
            '.zip': 'application/zip'
        };
        const contentType = mimeTypes[ext] || 'application/octet-stream';
        res.setHeader('Content-Type', contentType);

        // Stream the file
        const fileStream = fs.createReadStream(fullPath);
        fileStream.pipe(res);

        fileStream.on('error', (error) => {
            console.error('Error streaming file:', error);
            if (!res.headersSent) {
                res.status(500).json({ status: false, message: 'Error reading file' });
            }
        });

    } catch (error) {
        console.error('Download error:', error);
        if (!res.headersSent) {
            res.status(500).json({ status: false, message: 'Failed to download file' });
        }
    }
};