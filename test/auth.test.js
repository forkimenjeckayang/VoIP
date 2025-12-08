const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app');

describe('Auth API', () => {
    afterAll(async () => {
        await mongoose.connection.close();
    });

    it('should have a login endpoint', async () => {
        const res = await request(app).post('/api/auth/login').send({});
        // We expect 419 (Validation error) or similar, but NOT 404 (Not Found)
        expect(res.statusCode).not.toBe(404);
    });
});
