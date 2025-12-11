const twilio = require('twilio')
const { combineURLs } = require("./common.helper")
const { parsePhoneNumber } = require('libphonenumber-js')

const getClient = () => {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    if (!accountSid || !authToken) {
        throw new Error("TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN must be set in .env");
    }
    return twilio(accountSid, authToken);
}

const creatTwiml = () => {
    return new Promise(async (resolve) => {
        try {
            const client = getClient();
            const appName = "VoIP Suite Master App";

            // Singleton: Check if exists first
            const existingApps = await client.applications.list({ friendlyName: appName, limit: 1 });
            if (existingApps.length > 0) {
                // Update Voice URL to ensure it uses current BASE_URL
                await client.applications(existingApps[0].sid).update({
                    voiceMethod: "POST",
                    voiceUrl: combineURLs(
                        process.env.BASE_URL.trim(),
                        "api/call/make-call"
                    ),
                    statusCallback: combineURLs(
                        process.env.BASE_URL.trim(),
                        "api/call/status"
                    ),
                    statusCallbackMethod: "POST",
                });
                resolve(existingApps[0].sid);
                return;
            }

            // Create if not exists
            var twiml = await client.applications.create({
                voiceMethod: "POST",
                voiceUrl: combineURLs(
                    process.env.BASE_URL.trim(),
                    "api/call/make-call"
                ),
                statusCallback: combineURLs(
                    process.env.BASE_URL.trim(),
                    "api/call/status"
                ),
                statusCallbackMethod: "POST",
                friendlyName: appName,
            });
            resolve(twiml.sid)
        } catch (e) {
            console.log(e);
            resolve(false);
        }
    });
}

const updateTwiml = (twimlsid) => {
    return new Promise(async (resolve) => {
        try {
            const client = getClient();
            var twiml = await client.applications(twimlsid).update({
                voiceMethod: "POST",
                voiceUrl: combineURLs(
                    process.env.BASE_URL.trim(),
                    "api/call/make-call"
                ),
                statusCallback: combineURLs(
                    process.env.BASE_URL.trim(),
                    "api/call/status"
                ),
                statusCallbackMethod: "POST",
            });
            resolve(twiml.sid)
        } catch (e) {
            console.log(e);
            resolve(false);
        }
    });
}

const deleteTwiml = (twimlsid) => {
    return new Promise(async (resolve) => {
        try {
            const client = getClient();
            await client.applications(twimlsid).remove()
            resolve(true)
        } catch (e) {
            console.log(e);
            resolve(false);
        }
    });
}

const creatAPIKey = () => {
    return new Promise(async (resolve) => {
        try {
            const client = getClient();
            var apiKey = await client.newKeys.create({ friendlyName: 'VoIP Suite API Key' })
            resolve(apiKey)
        } catch (e) {
            console.log(e);
            resolve(false);
        }
    });
}

const removeAPIKey = (api_key) => {
    return new Promise(async (resolve) => {
        try {
            const client = getClient();
            await client.keys(api_key).remove();
            resolve(true)
        } catch (e) {
            console.log(e);
            resolve(false);
        }
    });
}

const unlinkNumber = (numbersid) => {
    return new Promise(async (resolve) => {
        try {
            const client = getClient();
            client.incomingPhoneNumbers(numbersid)
                .update({
                    smsUrl: '',
                    voiceUrl: '',
                    statusCallback: ''
                })
            resolve(true)
        } catch (e) {
            console.log(e);
            resolve(false);
        }
    });
}

// Configures the number to point to our SaaS endpoints
const configureNumber = (numbersid) => {
    return new Promise(async (resolve) => {
        try {
            const client = getClient();
            await client.incomingPhoneNumbers(numbersid)
                .update({
                    smsUrl: combineURLs(process.env.BASE_URL.trim(), "api/setting/receive-sms/twilio"),
                    smsMethod: 'POST',
                    voiceUrl: combineURLs(process.env.BASE_URL.trim(), "api/call/incomming"),
                    voiceMethod: 'POST'
                })
            resolve(true)
        } catch (e) {
            console.log(e);
            resolve(false);
        }
    });
}

const getInventory = () => {
    return new Promise(async (resolve) => {
        try {
            const client = getClient();
            // Fetch Incoming Numbers (Owned by Account)
            const numbers = await client.incomingPhoneNumbers.list({ limit: 1000 });

            // Filter by Configured Regions (Default to US)
            const allowedCountries = (process.env.ALLOWED_COUNTRIES || 'US').toUpperCase().split(',');
            // Example env: ALLOWED_COUNTRIES=US,CA,GB

            const filteredNumbers = numbers.filter(n => {
                let country = n.isoCountry;
                if (!country) {
                    try {
                        const parsed = parsePhoneNumber(n.phoneNumber);
                        if (parsed && parsed.country) {
                            country = parsed.country;
                        }
                    } catch (err) {
                        // console.log('Parsed Error', err)
                    }
                }
                return country && allowedCountries.includes(country.toUpperCase());
            });

            resolve(filteredNumbers);
        } catch (e) {
            console.log(e);
            resolve([]);
        }
    });
}

const twimlFallbackUpdate = (data) => {
    return new Promise(async (resolve) => {
        try {
            const client = getClient();
            await client.applications(data.twimlsid)
                .update({
                    voiceFallbackUrl: data.url,
                    voiceFallbackMethod: 'POST'
                })
            resolve(true)
        } catch (e) {
            console.log(e);
            resolve(false);
        }
    });
}

const numberFallbackUpdate = (data) => {
    return new Promise(async (resolve) => {
        try {
            const client = getClient();
            await client.incomingPhoneNumbers(data.numbersid)
                .update({
                    voiceFallbackUrl: data.voice_url,
                    voiceFallbackMethod: 'POST',
                    smsFallbackUrl: data.sms_url,
                    smsFallbackMethod: 'POST'
                })
            resolve(true)
        } catch (e) {
            console.log(e);
            resolve(false);
        }
    });
}

const twimlGet = (data) => {
    return new Promise(async (resolve) => {
        try {
            const client = getClient();
            var app = await client.applications(data.twimlsid)
                .fetch()
            resolve(app)
        } catch (e) {
            console.log(e);
            resolve(false);
        }
    });
}

const numberGet = (data) => {
    return new Promise(async (resolve) => {
        try {
            const client = getClient();
            var number = await client.incomingPhoneNumbers(data.numbersid)
                .fetch()
            resolve(number)
        } catch (e) {
            console.log(e);
            resolve(false);
        }
    });
}

const getAccountBalance = () => {
    return new Promise(async (resolve) => {
        try {
            const client = getClient();
            const balance = await client.balance.fetch();
            resolve(balance);
        } catch (e) {
            console.log(e);
            resolve(false);
        }
    });
}

module.exports = {
    creatTwiml, updateTwiml, deleteTwiml, creatAPIKey, removeAPIKey, unlinkNumber, configureNumber, getInventory, twimlFallbackUpdate, numberFallbackUpdate, twimlGet, numberGet, getAccountBalance
}