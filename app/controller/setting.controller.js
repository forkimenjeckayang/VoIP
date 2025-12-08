const Validator = require("validatorjs");
const moment = require("moment");
var mongoose = require("mongoose");
const twilio = require("twilio");
const path = require("path");
const http = require("https");
const fs = require("fs");
const request = require("request");
const crypto = require("crypto");

var Setting = require("../model/setting.model");
var User = require("../model/user.model");
var Message = require("../model/message.model");
const Numbers = require("twilio/lib/rest/Numbers");
var Contact = require("../model/contact.model");
var Email = require("../model/email.model");
const { exists } = require("../model/setting.model");
const { sendEmail, combineURLs } = require("../helper/common.helper");
const twilioHelper = require("../helper/twilio.helper");

exports.deleteKey = async (req, res) => {
  try {
    var settingCheck = await Setting.findOne({
      user: { $eq: req.body.user },
      _id: { $eq: req.body.profile_id },
    });
    try {
      if (settingCheck.app_key) {
        try {
          await twilioHelper.removeAPIKey(settingCheck.app_key);
        } catch (error) { }
      }

      // Unlink the number (remove webhooks)
      if (settingCheck.sid) {
        try {
          await twilioHelper.unlinkNumber(settingCheck.sid);
        } catch (error) { }
      }
    } catch (error) { }

    // We might want to remove the Setting record entirely or just nullify?
    // The previous code nullified fields.
    // In SaaS, if we "deleteKey", we are releasing the number?
    // If so, we should probably DELETE the setting record completely so the number becomes available again.
    // The previous code did `settingCheck.save()` with nulls. 
    // But `Setting` is the record of assignment.
    // Let's delete the record.
    await Setting.deleteOne({ _id: settingCheck._id });

    res.send({
      status: true,
      message: "Number released and setting deleted!",
      data: [],
    });

  } catch (error) {
    res.status(400).json({ status: "false", message: "Setting not deleted!" });
  }
};
exports.create = async (req, res) => {
  try {
    // SaaS configuration: Assign number from inventory
    let rules = {
      sid: "required", // Twilio Phone Number SID
      user: "required",
      profile: "required",
    };
    let validation = new Validator(req.body, rules);
    if (validation.passes()) {
      var user = await User.findOne({ _id: { $eq: req.body.user } });
      if (user) {
        // Enforce Max Number Limit (Default: 2)
        // Only check limit for NEW assignments (not updates)
        if (!req.body.setting) {
          const currentCount = await Setting.countDocuments({ user: req.body.user });
          const limit = process.env.MAX_NUMBERS_PER_USER || 2;

          if (currentCount >= limit) {
            return res.status(400).json({
              status: "false",
              message: `You have reached the maximum limit of ${limit} phone numbers.`,
            });
          }
        }

        // Check if this number is already assigned to anyone
        var existingSetting = await Setting.findOne({
          sid: { $eq: req.body.sid }
        });

        if (existingSetting) {
          return res.status(400).json({
            status: "false",
            message: "Number already assigned to another profile!",
          });
        }

        // Check if user already has a setting with THIS ID (update) or new
        // For simplicity, let's look for an existing setting for this profile name?
        // Actually, let's treat it as "Assign Number".
        // Use the passed setting ID if updating, or create new.

        // Fetch number details to get the actual phone number string (e.g. +1555...)
        var numberDetails = await twilioHelper.numberGet({ numbersid: req.body.sid });
        if (!numberDetails) {
          return res.status(400).json({ status: "false", message: "Invalid Twilio Number SID!" });
        }

        // Setup Resources
        var twiml_app_sid = await twilioHelper.creatTwiml();
        var apiKeyData = await twilioHelper.creatAPIKey();

        // Configure Number Webhooks
        await twilioHelper.configureNumber(req.body.sid);

        var settingData = {
          number: numberDetails.phoneNumber, // The string +12345...
          sid: req.body.sid, // The Twilio SID PN...
          user: req.body.user,
          type: "twilio",
          profile: req.body.profile,
          twiml_app: twiml_app_sid,
          app_key: apiKeyData.sid,
          app_secret: apiKeyData.secret
        };

        // If req.body.setting exists, update. Else create.
        if (req.body.setting) {
          await Setting.updateOne({ _id: req.body.setting }, settingData);
        } else {
          await Setting.create(settingData);
        }

        res.send({
          status: true,
          message: "Number assigned and configured successfully!",
          data: settingData,
        });

      } else {
        res.status(400).json({ status: "false", message: "User not found!" });
      }
    } else {
      res.status(419).send({ status: false, errors: validation.errors, data: [] });
    }
  } catch (error) {
    console.log(error);
    res.status(400).send({ status: false, message: error.message, data: [] });
  }
};
exports.getSetting = async (req, res) => {
  try {
    let rules = {
      setting: "required",
    };
    let validation = new Validator(req.body, rules);
    if (validation.passes()) {
      var settingCheck = await Setting.findOne({
        user: { $eq: req.user.id },
        _id: { $eq: req.body.setting },
      });
      if (settingCheck) {
        res.send({
          status: true,
          message: "setting data!",
          data: settingCheck,
        });
      } else {
        res
          .status(400)
          .json({ status: "false", message: "Setting not found!" });
      }
    } else {
      res
        .status(419)
        .send({ status: false, errors: validation.errors, data: [] });
    }
  } catch (error) {
    res.status(400).send({ status: false, errors: error.message, data: [] });
  }
};

exports.getNumber = async (req, res) => {
  try {
    // SaaS Inventory: Get unassigned numbers

    // 1. Get all numbers from Twilio Master Account
    const allNumbers = await twilioHelper.getInventory();

    // 2. Get all assigned numbers from DB
    const assignedSettings = await Setting.find({}, 'sid');
    const assignedSids = assignedSettings.map(s => s.sid);

    // 3. Filter: Only keep numbers NOT in assignedSids
    const availableNumbers = allNumbers.filter(num => !assignedSids.includes(num.sid));

    res.send({
      status: true,
      message: "Available Phone Number list retrieved.",
      data: availableNumbers,
    });

  } catch (error) {
    res.status(400).send({ status: false, errors: error.message, data: [] });
  }
};

exports.sendSms = async (req, res) => {
  try {
    let rules = {
      user: "required",
      numbers: "required",
      profile: "required",
    };
    let validation = new Validator(req.body, rules);
    if (validation.passes()) {
      var settingCheck = await Setting.findOne({
        user: { $eq: req.body.user },
        _id: { $eq: req.body.profile._id },
      });
      if (settingCheck) {
        // Use Master Creds
        const client = twilio(
          process.env.TWILIO_ACCOUNT_SID,
          process.env.TWILIO_AUTH_TOKEN
        );
        var arrMessageData = [];
        for (var i = 0; i < req.body.numbers.length; i++) {
          var toNumber = req.body.numbers[i];
          toNumber = toNumber
            .replace(/\s/g, "")
            .replace(/\-/g, "")
            .replace(/\)/g, "")
            .replace(/\(/g, "");
          var sendNumber = toNumber.length;
          if (sendNumber == 10) {
            toNumber = `+1${toNumber}`;
          }
          var twilioParams = {
            body: req.body.message,
            from: settingCheck.number,
            to: toNumber,
            statusCallback: combineURLs(
              process.env.BASE_URL.trim(),
              "api/setting/sms-status/twilio"
            ),
          };
          if (req.body.media.length > 0) {
            twilioParams.mediaUrl = req.body.media;
          }
          //media
          var sendSms = await client.messages.create(twilioParams);
          if (sendSms.sid !== undefined) {
            var messageData = {
              sid: sendSms.sid,
              user: req.body.user,
              number: toNumber,
              twilio_number: settingCheck.number,
              type: "send",
              status: "sent",
              isview: "true",
              message: req.body.message,
              setting: settingCheck._id,
            };
            var contact = await Contact.findOne({
              user: { $eq: req.body.user },
              number: { $eq: toNumber },
            });
            if (contact) {
              messageData.contact = contact._id;
            } else {
              toNumber = toNumber.slice(-10);
              var contact2 = await Contact.findOne({
                user: { $eq: req.body.user },
                number: { $eq: toNumber },
              });
              if (contact2) {
                messageData.contact = contact2._id;
              }
            }
            if (req.body.media.length > 0) {
              messageData.media = JSON.stringify(req.body.media);
            }
            arrMessageData.push(messageData);
          }
        }
        var messages = await Message.create(arrMessageData);
        if (messages) {
          res.send({
            status: true,
            message: "Message sent successfully!",
            data: messages,
          });
        } else {
          res
            .status(400)
            .json({ status: "false", message: "Message not sent!" });
        }
      } else {
        res.status(400).json({ status: "false", message: "Message not sent!" });
      }
    } else {
      res
        .status(419)
        .send({ status: false, errors: validation.errors, data: [] });
    }
  } catch (error) {
    console.log(error);
    res.status(400).send({ status: false, message: error.message, data: [] });
  }
};

exports.receiveSms = async (req, res) => {
  try {
    // Twilio-only: Handle incoming SMS webhooks
    var media = [];
    var messageText = req.body.Body;
    var toNumber = req.body.To;
    var fromnumber = req.body.From;
    var sid = req.body.SmsSid;
    if (req.body.NumMedia > 0) {
      var fackMedia = [];
      for (var i = 0; i < req.body.NumMedia; i++) {
        var tMedia = `MediaUrl${i}`;
        var tMediaType = `MediaContentType${i}`;
        const url = req.body[tMedia]; // link to file you want to download
        //var name = `uploads/${Date.now()}${req.body.SmsSid}.png`;
        // var name = crypto.randomBytes(24).toString('hex');
        if (tMediaType == "image/gif") {
          var name = `${crypto.randomBytes(24).toString("hex")}.gif`;
        } else if (tMediaType == "image/jpeg") {
          var name = `${crypto.randomBytes(24).toString("hex")}.jpg`;
        } else {
          var name = `${crypto.randomBytes(24).toString("hex")}.png`;
        }
        var date = moment(new Date()).format("MMDDYYYY");
        try {
          await fs.promises.access("./uploads/" + date);
        } catch (e) {
          await fs.promises.mkdir("./uploads/" + date);
        }

        request(url)
          .pipe(fs.createWriteStream(`./uploads/${date}/${name}`))
          .on("close", () => console.log("Image downloaded."));
        savedName = combineURLs(
          process.env.BASE_URL.trim(),
          "uploads",
          date,
          name
        );
        fackMedia.push(savedName);
        /*request(url).pipe(fs.createWriteStream(name))
                  .on('close', () => console.log('Image downloaded.'));
                  savedName = combineURLs(
                    process.env.BASE_URL.trim(),
                    "uploads",
                    date,
                    name
                  );
                  fackMedia.push(savedName)*/
      }
      media = fackMedia;
    }
    var settingCheck = await Setting.findOne({ number: { $eq: toNumber } });
    if (settingCheck) {
      var messageData2 = {
        sid: sid,
        user: settingCheck.user,
        number: fromnumber,
        twilio_number: toNumber,
        type: "receive",
        status: "received",
        isview: "false",
        message: messageText,
        setting: settingCheck._id,
        media: JSON.stringify(media),
      };

      var contact = await Contact.findOne({
        user: { $eq: settingCheck.user },
        number: { $eq: fromnumber },
      });

      if (contact) {
        messageData2.contact = contact._id;
      } else {
        contact = await Contact.findOne({
          user: { $eq: settingCheck.user },
          number: { $eq: fromnumber },
        });
        if (contact) {
          messageData2.contact = contact._id;
        }
      }

      global.io.to(settingCheck.user.toString()).emit("user_message", {
        message: messageText,
        number: fromnumber,
        twilio_number: toNumber,
        toUser: settingCheck.user,
        contact,
        type: "receive",
        status: "received",
        isview: false,
        settings: settingCheck,
      });
      console.log("settingCheck ===>", settingCheck);
      if (
        settingCheck.emailnotification !== undefined &&
        settingCheck.emailnotification == "true"
      ) {
        var emailSetting = await Email.findOne({
          user: { $eq: settingCheck.user },
        });
        if (emailSetting) {
          try {
            var emailData = {
              subject: `Message from ${fromnumber}`,
              text: "Message received",
              html: `Received Message on ${toNumber}:<br><hr><br><p>${messageText}</p><br><hr><br>`,
            };
            sendEmail(emailSetting, emailData);
          } catch (error) {
            // console.log(error)
          }
        }
      }
      // global.io.to(settingCheck.number).emit('new_message',{message: messageText, number:fromnumber});
      let messageSavedResponse = await Message.create(messageData2);
      console.log("messageSavedResponse ===:", messageSavedResponse);
    }
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const response = new VoiceResponse();
    console.log(response.toString());
    res.set("Content-Type", "text/xml");
    if (settingCheck) {
      sleep(settingCheck, req.body.SmsSid);
    }
    res.send();
  } catch (error) {
    res.status(400).json({ status: "false", message: "something went wrong" });
  }
};
function sleep(settingCheck, sid) {
  return new Promise((resolve) => {
    setTimeout(async function () {
      const client = twilio(
        process.env.TWILIO_ACCOUNT_SID,
        process.env.TWILIO_AUTH_TOKEN
      );

      for (var i = 0; i < 5; i++) {
        try {
          var deleteMessage = await client.messages(sid).remove();
          if (deleteMessage) {
            break;
          }
        } catch (error) { }
      }
      if (deleteMessage) {
        resolve(true);
      } else {
        resolve(false);
      }
    }, 5000);
  });
}
exports.smsStatus = async (req, res) => {
  try {
    // Twilio-only: Handle SMS status callbacks
    if (
      req.body.MessageStatus === "delivered" ||
      req.body.MessageStatus === "undelivered" ||
      req.body.MessageStatus === "failed"
    ) {
      var settingCheck = await Setting.findOne({
        number: { $eq: req.body.From },
      });
      if (settingCheck) {
        const client = twilio(
          process.env.TWILIO_ACCOUNT_SID,
          process.env.TWILIO_AUTH_TOKEN
        );
        for (var i = 0; i < 5; i++) {
          try {
            var isDelete = await client.messages(req.body.SmsSid).remove(); // Fix: sid was not defined, use req.body.SmsSid
            if (isDelete) {
              break;
            }
          } catch (error) { }
        } //remove Twilio sms from server right after sent with any status reply state
      }
    }
    // Fix: sid was not defined. req.body.SmsSid from callback
    var message = await Message.findOne({ sid: { $eq: req.body.SmsSid } });
    if (message) {
      message.status = req.body.MessageStatus; // Fix: status not defined
      message.save();
    }
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const response = new VoiceResponse();
    console.log(response.toString());
    res.set("Content-Type", "text/xml");
    res.send();
  } catch (error) {
    res.status(400).json({ status: "false", message: "something went wrong" });
  }
};

exports.getNumberList = async (req, res) => {
  try {
    var user_id = new mongoose.Types.ObjectId(req.body.user);
    var setting = new mongoose.Types.ObjectId(req.body.setting);
    var message = await Message.aggregate([
      { $match: { user: user_id, setting: setting } },
      { $sort: { _id: -1 } },
      {
        $group: {
          _id: "$number",
          message: { $first: "$message" },
          id: { $first: "$_id" },
          created_at: { $first: "$created_at" },
          contact: { $first: "$contact" },
          message_type: { $first: "$datatype" },
          type: { $first: "$type" },
          twilio_number: { $first: "$twilio_number" },
          id: { $first: "$_id" },
          isview: {
            $sum: {
              $cond: { if: { $eq: ["$isview", "false"] }, then: 1, else: 0 },
            },
          },
        },
      },
    ]);
    await Contact.populate(message, { path: "contact" });
    message.sort(function (a, b) {
      return b.created_at - a.created_at;
    });
    res.status(200).json(message);
  } catch (error) {
    res.status(400).json({ status: "false", message: "something went wrong" });
  }
};
exports.messageDelete = async (req, res) => {
  try {
    var deletecon = {
      user: { $eq: req.body.user },
      number: { $eq: req.body.number },
    };
    var messages = await Message.deleteMany(deletecon);
    if (messages) {
      res.status(200).send({ status: true, errors: "", data: messages });
    } else {
      res
        .status(400)
        .send({ status: false, errors: "Chat not deleted", data: [] });
    }
  } catch (error) {
    res.status(400).send({ status: false, errors: error.message, data: [] });
  }
};

exports.messageList = async (req, res) => {
  try {
    var filterObject = {
      user: { $eq: req.body.user },
      twilio_number: { $eq: req.body.number.twilio_number },
      number: { $eq: req.body.number._id },
      setting: { $eq: req.body.profile },
    };

    await Message.updateMany(
      { ...filterObject, isview: { $eq: "false" } },
      { isview: "true" }
    );
    var messages = await Message.find(filterObject);

    res.send(messages);
  } catch (error) {
    res.status(400).json({ status: "false", message: "something went wrong" });
  }
};
