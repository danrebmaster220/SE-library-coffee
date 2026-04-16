process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret';

const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');

const db = require('../config/db');
const {
    verifyToken,
    requireActiveShiftForNonAdmin
} = require('../middleware/auth');

const originalDbQuery = db.query;

let activeShiftRows = [];
let mustChangePasswordRows = [{ must_change_password: 0 }];
let dbQueryCount = 0;

const buildToken = (payload) => jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });

const app = express();
app.use(express.json());
app.get('/api/protected', verifyToken, requireActiveShiftForNonAdmin, (_req, res) => {
    res.json({ ok: true });
});

test.before(() => {
    db.query = async (sql) => {
        dbQueryCount += 1;

        if (String(sql).includes('COALESCE(must_change_password, 0) AS must_change_password')) {
            return [mustChangePasswordRows];
        }

        if (String(sql).includes('SELECT shift_id FROM shifts')) {
            return [activeShiftRows];
        }

        return [[]];
    };
});

test.after(() => {
    db.query = originalDbQuery;
});

test.beforeEach(() => {
    activeShiftRows = [];
    mustChangePasswordRows = [{ must_change_password: 0 }];
    dbQueryCount = 0;
});

test('rejects request when token is missing', async () => {
    const response = await request(app).get('/api/protected');

    assert.equal(response.status, 401);
    assert.match(response.body.error || '', /no token/i);
    assert.equal(dbQueryCount, 0);
});

test('rejects request when token is invalid', async () => {
    const response = await request(app)
        .get('/api/protected')
        .set('Authorization', 'Bearer invalid-token');

    assert.equal(response.status, 401);
    assert.match(response.body.error || '', /invalid|expired/i);
    assert.equal(dbQueryCount, 0);
});

test('blocks cashier without active shift', async () => {
    const cashierToken = buildToken({ user_id: 25, role: 'cashier' });

    const response = await request(app)
        .get('/api/protected')
        .set('Authorization', `Bearer ${cashierToken}`);

    assert.equal(response.status, 403);
    assert.match(response.body.error || '', /no active shift/i);
    assert.equal(dbQueryCount, 2);
});

test('allows cashier with active shift', async () => {
    const cashierToken = buildToken({ user_id: 25, role: 'cashier' });
    activeShiftRows = [{ shift_id: 9001 }];

    const response = await request(app)
        .get('/api/protected')
        .set('Authorization', `Bearer ${cashierToken}`);

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, { ok: true });
    assert.equal(dbQueryCount, 2);
});

test('allows admin without checking active shift', async () => {
    const adminToken = buildToken({ user_id: 1, role: 'admin' });

    const response = await request(app)
        .get('/api/protected')
        .set('Authorization', `Bearer ${adminToken}`);

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, { ok: true });
    assert.equal(dbQueryCount, 1);
});

test('blocks requests when password change is required', async () => {
    const cashierToken = buildToken({ user_id: 25, role: 'cashier' });
    mustChangePasswordRows = [{ must_change_password: 1 }];

    const response = await request(app)
        .get('/api/protected')
        .set('Authorization', `Bearer ${cashierToken}`);

    assert.equal(response.status, 428);
    assert.equal(response.body.code, 'MUST_CHANGE_PASSWORD');
    assert.equal(response.body.must_change_password, true);
    assert.equal(dbQueryCount, 1);
});
