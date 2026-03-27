#!/usr/bin/env node

/*
  Shift and realtime smoke checks.

  Required env for full run:
    API_ORIGIN=http://localhost:3000
    ADMIN_TOKEN=...
    CASHIER_TOKEN=...

  Optional:
    WAIT_FOR_SHIFT_EVENT=true
    SHIFT_EVENT_TIMEOUT_MS=25000
*/

const API_ORIGIN = process.env.API_ORIGIN || 'http://localhost:3000';
const API_BASE = `${API_ORIGIN.replace(/\/$/, '')}/api`;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';
const CASHIER_TOKEN = process.env.CASHIER_TOKEN || '';
const WAIT_FOR_SHIFT_EVENT = String(process.env.WAIT_FOR_SHIFT_EVENT || 'false').toLowerCase() === 'true';
const SHIFT_EVENT_TIMEOUT_MS = Number(process.env.SHIFT_EVENT_TIMEOUT_MS || 25000);

const results = [];

const pushResult = (name, ok, detail) => {
    results.push({ name, ok, detail });
    const icon = ok ? '✅' : '❌';
    console.log(`${icon} ${name}: ${detail}`);
};

const authHeaders = (token) => {
    if (!token) return {};
    return { Authorization: `Bearer ${token}` };
};

const requestJson = async (url, options = {}) => {
    const response = await fetch(url, options);
    let body = null;

    try {
        body = await response.json();
    } catch (_error) {
        body = null;
    }

    return { status: response.status, body };
};

const checkSocketAuthAndRealtime = async () => {
    let ioClient;
    try {
        ({ io: ioClient } = require('socket.io-client'));
    } catch (error) {
        pushResult('Realtime socket check', false, `socket.io-client dependency missing: ${error.message}`);
        return;
    }

    await new Promise((resolve) => {
        const socket = ioClient(API_ORIGIN, {
            auth: { token: `Bearer ${ADMIN_TOKEN}` },
            transports: ['websocket', 'polling'],
            timeout: 10000,
            reconnection: false
        });

        let done = false;
        const finish = (name, ok, detail) => {
            if (done) return;
            done = true;
            pushResult(name, ok, detail);
            socket.disconnect();
            resolve();
        };

        socket.on('connect', () => {
            if (!WAIT_FOR_SHIFT_EVENT) {
                finish('Realtime socket auth', true, 'connected with admin token');
                return;
            }

            const timer = setTimeout(() => {
                finish(
                    'Realtime propagation',
                    false,
                    `no shift:updated event received within ${SHIFT_EVENT_TIMEOUT_MS}ms (trigger a shift action while running)`
                );
            }, SHIFT_EVENT_TIMEOUT_MS);

            socket.once('shift:updated', (payload) => {
                clearTimeout(timer);
                finish('Realtime propagation', true, `received shift:updated (${payload?.action || 'unknown action'})`);
            });
        });

        socket.on('connect_error', (error) => {
            finish('Realtime socket auth', false, error.message || 'connect_error');
        });
    });
};

(async () => {
    console.log(`\n🔎 Running smoke checks against ${API_ORIGIN}\n`);

    try {
        const health = await requestJson(`${API_ORIGIN.replace(/\/$/, '')}/health`);
        pushResult('Health endpoint', health.status === 200, `status=${health.status}`);
    } catch (error) {
        pushResult('Health endpoint', false, error.message);
    }

    if (!ADMIN_TOKEN) {
        pushResult('Admin checks', false, 'ADMIN_TOKEN not set');
    } else {
        try {
            const active = await requestJson(`${API_BASE}/shifts/active`, {
                headers: {
                    ...authHeaders(ADMIN_TOKEN)
                }
            });
            const activeCount = Array.isArray(active.body?.shifts) ? active.body.shifts.length : -1;
            pushResult('Active shifts endpoint', active.status === 200, `status=${active.status}, count=${activeCount}`);

            const history = await requestJson(`${API_BASE}/shifts/history`, {
                headers: {
                    ...authHeaders(ADMIN_TOKEN)
                }
            });
            const historyRows = Array.isArray(history.body?.shifts) ? history.body.shifts : [];
            const likelyForceClosed = historyRows.filter((row) => row.actual_cash == null && row.cash_difference == null).length;
            const taggedForceClosed = historyRows.filter((row) => Number(row.is_force_closed) === 1).length;
            const labelSignalOk = taggedForceClosed <= likelyForceClosed;

            pushResult('Shift history endpoint', history.status === 200, `status=${history.status}, rows=${historyRows.length}`);
            pushResult(
                'Force-close label signal',
                labelSignalOk,
                `tagged=${taggedForceClosed}, candidates=${likelyForceClosed}`
            );
        } catch (error) {
            pushResult('Admin checks', false, error.message);
        }

        await checkSocketAuthAndRealtime();
    }

    if (!CASHIER_TOKEN) {
        pushResult('Cashier checks', false, 'CASHIER_TOKEN not set');
    } else {
        try {
            const myShift = await requestJson(`${API_BASE}/shifts/my-active`, {
                headers: {
                    ...authHeaders(CASHIER_TOKEN)
                }
            });
            const hasShiftKey = Object.prototype.hasOwnProperty.call(myShift.body || {}, 'shift');
            pushResult('Cashier my-active endpoint', myShift.status === 200 && hasShiftKey, `status=${myShift.status}`);
        } catch (error) {
            pushResult('Cashier checks', false, error.message);
        }
    }

    const failed = results.filter((item) => !item.ok);
    console.log('\n📊 Smoke summary:', `${results.length - failed.length}/${results.length} checks passed`);

    process.exit(failed.length > 0 ? 1 : 0);
})();
