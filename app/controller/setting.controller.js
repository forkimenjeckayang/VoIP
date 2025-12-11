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

    // Emit socket event to notify frontend of profile/number deletion
    if (global.io && settingCheck.user) {
        global.io.to(settingCheck.user.toString()).emit('profile_deleted', {
            profile_id: settingCheck._id,
            user: settingCheck.user
        });
    }

    res.send({
      status: true,
      message: "Number released and setting deleted! Messages are preserved.",
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
        // Enforce Max Number Limit (Default: 1)
        // Users can only have 1 active phone number at a time
        // They can switch by deleting the current one and adding a new one
        // Only check limit for NEW assignments (not updates)
        if (!req.body.setting) {
          const currentCount = await Setting.countDocuments({ user: req.body.user });
          const limit = process.env.MAX_NUMBERS_PER_USER || 1;

          if (currentCount >= limit) {
            return res.status(400).json({
              status: "false",
              message: `You can only have ${limit} active phone number at a time. Please delete your current number before adding a new one.`,
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
        let savedSetting;
        if (req.body.setting) {
          await Setting.updateOne({ _id: req.body.setting }, settingData);
          savedSetting = await Setting.findOne({ _id: req.body.setting });
        } else {
          savedSetting = await Setting.create(settingData);
        }

        // Emit socket event to notify frontend of profile creation/update
        if (global.io && req.body.user) {
          global.io.to(req.body.user.toString()).emit('profile_created', {
            profile_id: savedSetting._id,
            user: req.body.user
          });
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

exports.getBalance = async (req, res) => {
  try {
    const balanceData = await twilioHelper.getAccountBalance();
    if (balanceData) {
      res.send({
        status: true,
        message: "Account balance retrieved.",
        data: balanceData,
      });
    } else {
      res.status(400).json({ status: "false", message: "Failed to retrieve balance." });
    }
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

          // STRICT: Only use the configured number from the database.
          // The profile creation/assignment logic MUST ensure this field is populated.
          const fromNumber = settingCheck.number;

          if (!fromNumber) {
            return res.status(400).json({ status: "false", message: "Sender number not configured for this profile. Please delete and recreate the profile." });
          }

          var twilioParams = {
            body: req.body.message,
            from: fromNumber,
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
          // Emit socket events for each sent message
          // Use req.user.id from JWT token (matches socket channel) or fallback to req.body.user
          const userId = (req.user?.id || req.body.user)?.toString ? (req.user?.id || req.body.user).toString() : (req.user?.id || req.body.user);
          console.log('📤 Emitting new_message to user:', userId);
          if (Array.isArray(messages)) {
            messages.forEach((msg) => {
              const messageData = {
                _id: msg._id,
                number: msg.number,
                twilio_number: msg.twilio_number,
                type: msg.type,
                message: msg.message,
                body: msg.message, // Also include 'body' for frontend compatibility
                direction: 'outbound',
                status: msg.status,
                created_at: msg.created_at,
                timestamp: msg.created_at,
                user: msg.user,
                setting: msg.setting
              };
              console.log('📤 Emitting message data:', messageData);
              global.io.to(userId).emit('new_message', messageData);
            });
          } else {
            // Single message (shouldn't happen with array, but just in case)
            global.io.to(userId).emit('new_message', {
              _id: messages._id,
              number: messages.number,
              twilio_number: messages.twilio_number,
              type: messages.type,
              message: messages.message,
              body: messages.message,
              direction: 'outbound',
              status: messages.status,
              created_at: messages.created_at,
              timestamp: messages.created_at,
              user: messages.user,
              setting: messages.setting
            });
          }
          
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

      // Emit new_message event for incoming messages (before saving to DB)
      // This will be emitted again after saving with the full message object
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
      
      // Emit new_message event for incoming messages (after saving to DB)
      // Ensure user ID format matches socket channel (could be ObjectId or string)
      if (messageSavedResponse) {
        const userId = settingCheck.user?.toString ? settingCheck.user.toString() : settingCheck.user;
        console.log('📥 Emitting new_message (incoming) to user:', userId);
        const messageData = {
          _id: messageSavedResponse._id,
          number: messageSavedResponse.number,
          twilio_number: messageSavedResponse.twilio_number,
          type: messageSavedResponse.type,
          message: messageSavedResponse.message,
          body: messageSavedResponse.message, // Also include 'body' for frontend compatibility
          direction: 'inbound',
          status: messageSavedResponse.status,
          created_at: messageSavedResponse.created_at,
          timestamp: messageSavedResponse.created_at,
          user: messageSavedResponse.user,
          setting: messageSavedResponse.setting
        };
        console.log('📥 Emitting message data:', messageData);
        global.io.to(userId).emit('new_message', messageData);
      }
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
    
    // If setting is provided, filter by it; otherwise, get all messages for the user
    // This allows viewing messages even when no profile is selected (like phone without SIM)
    // Only get messages, not calls, for conversation list
    var matchStage = { 
      user: user_id,
      datatype: 'message' // Only show messages in conversations, not calls
    };
    if (req.body.setting) {
      var setting = new mongoose.Types.ObjectId(req.body.setting);
      matchStage.setting = setting;
    }
    
    var message = await Message.aggregate([
      { $match: matchStage },
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
    console.error('getNumberList error:', error);
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
      // Emit socket event to notify frontend of message deletion
      const userId = req.user?.id || req.body.user;
      if (global.io && userId) {
        global.io.to(userId.toString()).emit('messages_deleted', {
          user: userId,
          number: req.body.number
        });
      }
      
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

exports.deleteSingleMessage = async (req, res) => {
  try {
    const messageId = req.body.message_id;
    const userId = req.user?.id || req.body.user;
    
    if (!messageId) {
      return res.status(400).send({ status: false, errors: "Message ID is required", data: [] });
    }

    // Find the message first to get the number for socket event
    const message = await Message.findOne({ 
      _id: { $eq: messageId },
      user: { $eq: userId }
    });

    if (!message) {
      return res.status(404).send({ status: false, errors: "Message not found", data: [] });
    }

    // Delete the single message
    const deletedMessage = await Message.deleteOne({ 
      _id: { $eq: messageId },
      user: { $eq: userId }
    });

    if (deletedMessage.deletedCount > 0) {
      // Emit socket event to notify frontend of single message deletion
      if (global.io && userId) {
        global.io.to(userId.toString()).emit('message_deleted', {
          user: userId,
          message_id: messageId,
          number: message.number
        });
      }
      
      res.status(200).send({ status: true, errors: "", data: deletedMessage });
    } else {
      res.status(400).send({ status: false, errors: "Message not deleted", data: [] });
    }
  } catch (error) {
    res.status(400).send({ status: false, errors: error.message, data: [] });
  }
};

exports.messageList = async (req, res) => {
  try {
    let filterObject;

    if (req.body.phoneNumber) {
      // Corrected Query Logic:
      // In Message Model:
      // 'number' = The external contact's number (usually)
      // 'twilio_number' = Our Twilio number (usually)
      // However, for incoming/outgoing, these might flip or store consistently.
      // Based on sendSms: number=To (Recipient), twilio_number=From (Us).
      // Based on receiveSms: number=From (Sender/Contact), twilio_number=To (Us).

      // So 'number' ALWAYS seems to be the CONTACT'S number (the other party).
      // And 'twilio_number' ALWAYS seems to be OUR number.

      // So if req.body.phoneNumber is the CONTACT'S number, we just need to search `number`.
      // But just to be safe and cover all bases (in case data is mixed), we check both.

      filterObject = {
        user: { $eq: req.user.id },
        datatype: { $eq: 'message' }, // Only get messages, not calls
        $or: [
          { number: { $eq: req.body.phoneNumber } },
          { twilio_number: { $eq: req.body.phoneNumber } },
          // Also check 'from'/'to' just in case of any legacy data or future migration
          { from: { $eq: req.body.phoneNumber } },
          { to: { $eq: req.body.phoneNumber } }
        ]
      };
    } else {
      // Old format for backward compatibility
      filterObject = {
        user: { $eq: req.body.user },
        datatype: { $eq: 'message' }, // Only get messages, not calls
        twilio_number: { $eq: req.body.number.twilio_number },
        number: { $eq: req.body.number._id },
        setting: { $eq: req.body.profile },
      };
    }

    // Mark as read (only for messages, not calls)
    await Message.updateMany(
      { ...filterObject, isview: { $eq: "false" }, datatype: { $eq: "message" } },
      { isview: "true" }
    );

    var messages = await Message.find(filterObject).sort({ created_at: 1 }); // Note: updated to created_at from createdAt to match schema

    res.send({ status: 'true', data: messages });
  } catch (error) {
    console.error('Message list error:', error);
    res.status(400).json({ status: "false", message: "something went wrong" });
  }
};

exports.getStats = async (req, res) => {
  try {
    const user_id = req.body.user || req.user?.id;
    if (!user_id) {
      return res.status(400).json({ status: false, message: 'User ID is required' });
    }

    // Count messages (datatype: 'message')
    const messageCount = await Message.countDocuments({
      user: user_id,
      datatype: 'message'
    });

    // Count calls (datatype: 'call')
    const callCount = await Message.countDocuments({
      user: user_id,
      datatype: 'call'
    });

    res.status(200).json({
      status: true,
      message: 'Stats retrieved successfully',
      data: {
        messages: messageCount,
        calls: callCount
      }
    });
  } catch (error) {
    console.error('getStats error:', error);
    res.status(500).json({ status: false, message: 'Something went wrong' });
  }
};
