
const request = require('supertest');
const mongoose = require('mongoose');
const twilioHelper = require('../app/helper/twilio.helper');

// Mock Mongoose Models
// We must mock them before requiring app.js, or before the controller uses them.
jest.mock('../app/model/user.model', () => ({
    findOne: jest.fn(),
    create: jest.fn(),
    updateOne: jest.fn()
}));
jest.mock('../app/model/setting.model', () => ({
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    deleteOne: jest.fn(),
    updateOne: jest.fn(),
    countDocuments: jest.fn()
}));
jest.mock('../app/middleware/auth.middleware', () => (req, res, next) => {
    req.user = { id: 'user123' };
    next();
});
jest.mock('../app/helper/twilio.helper');

const User = require('../app/model/user.model');
const Setting = require('../app/model/setting.model');
const app = require('../app');

describe('SaaS Inventory & Assignment Flow', () => {

    afterAll(async () => {
        await mongoose.connection.close();
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('Inventory (POST /api/setting/get-number)', () => {
        it('should return available numbers', async () => {
            // Mock Inventory
            const mockInventory = [
                { sid: 'PN1', phoneNumber: '+1111111111', isoCountry: 'US' },
                { sid: 'PN2', phoneNumber: '+2222222222', isoCountry: 'US' }
            ];
            twilioHelper.getInventory.mockResolvedValue(mockInventory);

            // Mock DB to say no numbers are assigned
            Setting.find.mockResolvedValue([]);

            const res = await request(app).post('/api/setting/get-number').send({ type: 'twilio' });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data).toHaveLength(2);
        });
    });

    describe('Assignment (POST /api/setting/create)', () => {
        it('should assign a number to a user', async () => {
            // Setup Mocks
            User.findOne.mockResolvedValue({ _id: 'user123', email: 'test@test.com' }); // User exists
            Setting.findOne.mockResolvedValue(null); // No existing assignment for this number
            Setting.countDocuments.mockResolvedValue(0); // User has 0 numbers (under limit)

            twilioHelper.numberGet.mockResolvedValue({ phoneNumber: '+1111111111' });
            twilioHelper.creatTwiml.mockResolvedValue('AP123'); // App SID
            twilioHelper.creatAPIKey.mockResolvedValue({ sid: 'SK123', secret: 'secret' });
            twilioHelper.configureNumber.mockResolvedValue(true);

            // Mock Create
            Setting.create.mockResolvedValue({ sid: 'PN123', user: 'user123' });

            const payload = {
                user: 'user123',
                profile: 'My Business Line',
                sid: 'PN123' // The number we want
            };

            const res = await request(app).post('/api/setting/create').send(payload);

            expect(res.statusCode).toEqual(200);
            expect(res.body.status).toBe(true);
            expect(res.body.message).toContain('assigned');

            // Verify Logic
            expect(twilioHelper.configureNumber).toHaveBeenCalledWith('PN123'); // Webhooks configured
            expect(Setting.create).toHaveBeenCalled(); // Saved to DB
        });

        it('should reject if max limit reached', async () => {
            User.findOne.mockResolvedValue({ _id: 'user123' });
            Setting.countDocuments.mockResolvedValue(10); // User explicitly has 10 numbers
            process.env.MAX_NUMBERS_PER_USER = 2;

            const res = await request(app).post('/api/setting/create').send({
                user: 'user123', profile: 'Test', sid: 'PN123'
            });

            expect(res.statusCode).toEqual(400);
            expect(res.body.message).toContain('maximum limit');
        });
    });

    describe('Release (POST /api/setting/delete-key)', () => {
        it('should release number and clean up', async () => {
            const mockSetting = {
                _id: 'settings123',
                user: 'user123',
                sid: 'PN123',
                app_key: 'SK123',
                twiml_app: 'AP123'
            };
            Setting.findOne.mockResolvedValue(mockSetting);

            const res = await request(app).post('/api/setting/delete-key').send({
                user: 'user123',
                profile_id: 'settings123'
            });

            expect(res.statusCode).toEqual(200);

            // Verify Twilio Cleanup
            expect(twilioHelper.removeAPIKey).toHaveBeenCalledWith('SK123');
            expect(twilioHelper.unlinkNumber).toHaveBeenCalledWith('PN123');
            // Important: We should NOT delete the singleton TwiML app
            expect(twilioHelper.deleteTwiml).not.toHaveBeenCalled();

            // Verify DB Cleanup
            expect(Setting.deleteOne).toHaveBeenCalledWith({ _id: 'settings123' });
        });
    });

    describe('Balance (POST /api/setting/get-balance)', () => {
        it('should return account balance', async () => {
            // Mock Balance
            const mockBalance = {
                balance: '50.00',
                currency: 'USD'
            };
            // Ensure the mock function exists (jest auto-mock should handle it if the file requires correctly)
            if (twilioHelper.getAccountBalance) {
                twilioHelper.getAccountBalance.mockResolvedValue(mockBalance);
            } else {
                // Fallback if auto-mock didn't pick it up yet (though it should)
                twilioHelper.getAccountBalance = jest.fn().mockResolvedValue(mockBalance);
            }

            const res = await request(app).post('/api/setting/get-balance').send({});

            expect(res.statusCode).toEqual(200);
            expect(res.body.status).toBe(true);
            expect(res.body.data.balance).toEqual('50.00');
        });
    });

});

