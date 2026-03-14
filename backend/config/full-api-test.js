const https = require('https');

const BASE = 'library-coffee-api.onrender.com';

function request(method, path, data = null, token = null) {
  return new Promise((resolve, reject) => {
    const body = data ? JSON.stringify(data) : null;
    const options = {
      hostname: BASE,
      path: '/api' + path,
      method,
      headers: { 'Content-Type': 'application/json' }
    };
    if (token) options.headers['Authorization'] = `Bearer ${token}`;
    if (body) options.headers['Content-Length'] = Buffer.byteLength(body);

    const req = https.request(options, (res) => {
      let result = '';
      res.on('data', (chunk) => result += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(result) });
        } catch {
          resolve({ status: res.statusCode, data: result });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

(async () => {
  let passed = 0, failed = 0;
  const results = [];

  function check(name, ok, detail = '') {
    if (ok) { passed++; results.push(`✅ ${name}`); }
    else { failed++; results.push(`❌ ${name}${detail ? ': ' + detail : ''}`); }
  }

  // ============================================
  // 1. AUTH - Login
  // ============================================
  console.log('--- 1. AUTH ---');
  
  const loginRes = await request('POST', '/auth/login', { username: 'admin', password: 'password123' });
  check('Admin Login', loginRes.status === 200 && loginRes.data.token, `status=${loginRes.status}, err=${loginRes.data?.error || ''}`);
  const token = loginRes.data?.token;

  const staffLogin = await request('POST', '/auth/login', { username: 'cashier', password: 'password123' });
  check('Cashier Login', staffLogin.status === 200 && staffLogin.data.token, `status=${staffLogin.status}, err=${staffLogin.data?.error || ''}`);

  const badLogin = await request('POST', '/auth/login', { username: 'admin', password: 'wrongpassword' });
  check('Bad Login Rejected', badLogin.status !== 200, `status=${badLogin.status}`);

  // Auth - me endpoint
  if (token) {
    const meRes = await request('GET', '/auth/me', null, token);
    check('GET /auth/me', meRes.status === 200 && meRes.data.user, `status=${meRes.status}`);
  }

  // ============================================
  // 2. DASHBOARD
  // ============================================
  console.log('--- 2. DASHBOARD ---');
  
  if (token) {
    const dashRes = await request('GET', '/dashboard/stats', null, token);
    check('Dashboard Stats', dashRes.status === 200 && dashRes.data.todayOrders !== undefined, 
      `status=${dashRes.status}, keys=${Object.keys(dashRes.data || {}).join(',')}`);

    const recentRes = await request('GET', '/dashboard/recent-orders', null, token);
    check('Recent Orders', recentRes.status === 200, `status=${recentRes.status}`);
  }

  // ============================================
  // 3. MENU
  // ============================================
  console.log('--- 3. MENU ---');

  const catRes = await request('GET', '/menu/categories', null, token);
  check('GET Categories', catRes.status === 200 && Array.isArray(catRes.data), 
    `status=${catRes.status}, count=${catRes.data?.length}`);

  const itemsRes = await request('GET', '/menu/items', null, token);
  check('GET Items', itemsRes.status === 200 && Array.isArray(itemsRes.data), 
    `status=${itemsRes.status}, count=${itemsRes.data?.length}`);

  // Check items have images
  if (Array.isArray(itemsRes.data)) {
    const withImages = itemsRes.data.filter(i => i.image);
    check('Items with Images', withImages.length >= 6, 
      `${withImages.length}/${itemsRes.data.length} have images`);
  }

  // ============================================
  // 4. POS - Orders
  // ============================================
  console.log('--- 4. POS ---');

  if (token) {
    const ordersRes = await request('GET', '/pos/orders', null, token);
    check('GET POS Orders', ordersRes.status === 200, `status=${ordersRes.status}`);

    // Get beepers
    const beepersRes = await request('GET', '/pos/beepers', null, token);
    check('GET Beepers', beepersRes.status === 200 && Array.isArray(beepersRes.data), 
      `status=${beepersRes.status}, count=${beepersRes.data?.length}`);

    // Check available beepers
    if (Array.isArray(beepersRes.data)) {
      const available = beepersRes.data.filter(b => b.status === 'available');
      check('Available Beepers', available.length >= 1, `${available.length} available`);
    }

    // Quick cash amounts
    const qcRes = await request('GET', '/pos/quick-cash', null, token);
    check('GET Quick Cash', qcRes.status === 200, `status=${qcRes.status}`);
  }

  // ============================================
  // 5. KIOSK ORDER FLOW (full test)
  // ============================================
  console.log('--- 5. KIOSK ORDER FLOW ---');

  // Place kiosk order
  const kioskOrder = await request('POST', '/pos/kiosk/order', {
    order_type: 'dine-in',
    items: [{
      item_id: 2, item_name: 'Americano', quantity: 1, unit_price: 150, total_price: 150,
      customizations: []
    }],
    subtotal: 150,
    total_amount: 150
  });
  check('Kiosk Place Order', kioskOrder.status === 200 && kioskOrder.data.transaction_id, 
    `status=${kioskOrder.status}, txId=${kioskOrder.data?.transaction_id}`);

  const testTxId = kioskOrder.data?.transaction_id;
  const testBeeper = kioskOrder.data?.beeper_number;

  // Process payment
  if (testTxId && token) {
    const payRes = await request('POST', `/pos/orders/${testTxId}/pay`, {
      discount_id: null,
      discount_amount: 0,
      cash_tendered: 200,
      change_due: 50
    }, token);
    check('Process Payment', payRes.status === 200, `status=${payRes.status}, msg=${payRes.data?.message || payRes.data?.error}`);

    // Mark ready
    const readyRes = await request('POST', `/pos/orders/${testTxId}/ready`, null, token);
    check('Mark Ready', readyRes.status === 200, `status=${readyRes.status}, msg=${readyRes.data?.error || ''}`);

    // Complete order
    const completeRes = await request('POST', `/pos/orders/${testTxId}/complete`, null, token);
    check('Complete Order', completeRes.status === 200, `status=${completeRes.status}, msg=${completeRes.data?.error || ''}`);
  }

  // ============================================
  // 6. CUSTOMIZATIONS
  // ============================================
  console.log('--- 6. CUSTOMIZATIONS ---');

  if (token) {
    const custRes = await request('GET', '/customizations/groups', null, token);
    check('GET Customization Groups', custRes.status === 200 && Array.isArray(custRes.data), 
      `status=${custRes.status}, count=${custRes.data?.length}`);

    // Get customizations for a specific item (Americano, item_id=2, is_customizable=1)
    const itemCustRes = await request('GET', '/customizations/items/2/customizations', null, token);
    check('GET Item Customizations', itemCustRes.status === 200, 
      `status=${itemCustRes.status}`);
  }

  // ============================================
  // 7. DISCOUNTS
  // ============================================
  console.log('--- 7. DISCOUNTS ---');

  if (token) {
    const discRes = await request('GET', '/discounts', null, token);
    check('GET Discounts', discRes.status === 200 && Array.isArray(discRes.data), 
      `status=${discRes.status}, count=${discRes.data?.length}`);
  }

  // ============================================
  // 8. LIBRARY
  // ============================================
  console.log('--- 8. LIBRARY ---');

  if (token) {
    const tablesRes = await request('GET', '/library/tables', null, token);
    check('GET Library Tables', tablesRes.status === 200, `status=${tablesRes.status}`);

    const seatsRes = await request('GET', '/library/seats', null, token);
    check('GET Library Seats', seatsRes.status === 200, `status=${seatsRes.status}`);

    const sessionsRes = await request('GET', '/library/sessions', null, token);
    check('GET Library Sessions', sessionsRes.status === 200, `status=${sessionsRes.status}`);
  }

  // ============================================
  // 9. REPORTS
  // ============================================
  console.log('--- 9. REPORTS ---');

  if (token) {
    const salesRes = await request('GET', '/reports/sales-summary', null, token);
    check('GET Sales Summary', salesRes.status === 200, `status=${salesRes.status}`);

    const topRes = await request('GET', '/reports/top-items', null, token);
    check('GET Top Items', topRes.status === 200, `status=${topRes.status}`);
  }

  // ============================================
  // 10. USERS
  // ============================================
  console.log('--- 10. USERS ---');

  if (token) {
    const usersRes = await request('GET', '/users', null, token);
    check('GET Users', usersRes.status === 200 && Array.isArray(usersRes.data), 
      `status=${usersRes.status}, count=${usersRes.data?.length}`);

    const rolesRes = await request('GET', '/users/roles', null, token);
    check('GET Roles', rolesRes.status === 200, `status=${rolesRes.status}`);
  }

  // ============================================
  // RESULTS
  // ============================================
  console.log('\n' + '='.repeat(50));
  console.log('TEST RESULTS');
  console.log('='.repeat(50));
  results.forEach(r => console.log(r));
  console.log('='.repeat(50));
  console.log(`PASSED: ${passed}  |  FAILED: ${failed}  |  TOTAL: ${passed + failed}`);
  console.log(failed === 0 ? '🎉 ALL TESTS PASSED!' : `⚠️ ${failed} TEST(S) FAILED`);
  console.log('='.repeat(50));
})();
