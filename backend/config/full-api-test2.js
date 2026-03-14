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
    if (ok) { passed++; results.push(`  ✅ ${name}`); }
    else { failed++; results.push(`  ❌ ${name}${detail ? ' → ' + detail : ''}`); }
  }

  // ============================================
  // 1. AUTH
  // ============================================
  console.log('🔐 1. AUTH');
  
  const loginRes = await request('POST', '/auth/login', { username: 'admin', password: 'password123' });
  check('Admin Login', loginRes.status === 200 && loginRes.data.token, `${loginRes.status} ${loginRes.data?.error || ''}`);
  const token = loginRes.data?.token;

  const cashierLogin = await request('POST', '/auth/login', { username: 'cashier', password: 'password123' });
  check('Cashier Login', cashierLogin.status === 200 && cashierLogin.data.token, `${cashierLogin.status} ${cashierLogin.data?.error || ''}`);

  const badLogin = await request('POST', '/auth/login', { username: 'admin', password: 'wrongpassword' });
  check('Bad Login Rejected', badLogin.status === 401);

  // /auth/verify (GET)
  if (token) {
    const verifyRes = await request('GET', '/auth/verify', null, token);
    check('GET /auth/verify', verifyRes.status === 200, `${verifyRes.status}`);
  }

  // ============================================
  // 2. DASHBOARD
  // ============================================
  console.log('📊 2. DASHBOARD');
  
  if (token) {
    const dashRes = await request('GET', '/dashboard/stats', null, token);
    check('Dashboard Stats', dashRes.status === 200, `${dashRes.status} ${JSON.stringify(dashRes.data).substring(0, 80)}`);

    const chartRes = await request('GET', '/dashboard/sales-chart', null, token);
    check('Sales Chart', chartRes.status === 200, `${chartRes.status}`);

    const catSalesRes = await request('GET', '/dashboard/category-sales', null, token);
    check('Category Sales', catSalesRes.status === 200, `${catSalesRes.status}`);

    const libStatusRes = await request('GET', '/dashboard/library-status', null, token);
    check('Library Status', libStatusRes.status === 200, `${libStatusRes.status}`);
  }

  // ============================================
  // 3. MENU
  // ============================================
  console.log('📋 3. MENU');

  const catRes = await request('GET', '/menu/categories', null, token);
  check('GET Categories', catRes.status === 200 && Array.isArray(catRes.data), `${catRes.status} count=${catRes.data?.length}`);

  const itemsRes = await request('GET', '/menu/items', null, token);
  check('GET Items', itemsRes.status === 200 && Array.isArray(itemsRes.data), `${itemsRes.status} count=${itemsRes.data?.length}`);

  if (Array.isArray(itemsRes.data)) {
    const withImages = itemsRes.data.filter(i => i.image);
    check('Items with Images', withImages.length >= 6, `${withImages.length}/${itemsRes.data.length} have images`);
  }

  // ============================================
  // 4. POS
  // ============================================
  console.log('💰 4. POS');

  if (token) {
    const ordersRes = await request('GET', '/pos/orders', null, token);
    check('GET POS Orders', ordersRes.status === 200, `${ordersRes.status}`);

    const beepersRes = await request('GET', '/pos/beepers', null, token);
    check('GET Beepers', beepersRes.status === 200, `${beepersRes.status} count=${beepersRes.data?.length}`);

    if (Array.isArray(beepersRes.data)) {
      const available = beepersRes.data.filter(b => b.status === 'available');
      check('Available Beepers', available.length >= 1, `${available.length} available`);
    }

    const qcRes = await request('GET', '/pos/quick-cash', null, token);
    check('GET Quick Cash', qcRes.status === 200, `${qcRes.status}`);
  }

  // ============================================
  // 5. KIOSK FULL ORDER FLOW
  // ============================================
  console.log('📱 5. KIOSK ORDER FLOW');

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
    `${kioskOrder.status} txId=${kioskOrder.data?.transaction_id} err=${kioskOrder.data?.error || ''}`);

  const testTxId = kioskOrder.data?.transaction_id;

  if (testTxId && token) {
    // Process payment: PUT /pos/transactions/:id/pay
    const payRes = await request('PUT', `/pos/transactions/${testTxId}/pay`, {
      discount_id: null,
      discount_amount: 0,
      cash_tendered: 200,
      change_due: 50
    }, token);
    check('Process Payment', payRes.status === 200, `${payRes.status} ${payRes.data?.error || payRes.data?.message || ''}`);

    // Mark ready: PUT /pos/orders/:id/ready
    const readyRes = await request('PUT', `/pos/orders/${testTxId}/ready`, null, token);
    check('Mark Ready', readyRes.status === 200, `${readyRes.status} ${readyRes.data?.error || ''}`);

    // Complete order: PUT /pos/orders/:id/complete
    const completeRes = await request('PUT', `/pos/orders/${testTxId}/complete`, null, token);
    check('Complete Order', completeRes.status === 200, `${completeRes.status} ${completeRes.data?.error || ''}`);
  }

  // ============================================
  // 6. POS DIRECT ORDER (staff creates order)
  // ============================================
  console.log('🧾 6. POS DIRECT ORDER');

  if (token) {
    const posOrder = await request('POST', '/pos/transactions', {
      beeper_number: 2,
      order_type: 'takeout',
      items: [{
        item_id: 5, item_name: 'Cappuccino', quantity: 1, unit_price: 200, total_price: 200,
        customizations: []
      }],
      subtotal: 200,
      total_amount: 200,
      cash_tendered: 500,
      change_due: 300,
      status: 'preparing'
    }, token);
    check('POS Create Transaction', posOrder.status === 200 || posOrder.status === 201, 
      `${posOrder.status} ${posOrder.data?.error || ''} txId=${posOrder.data?.transaction_id || ''}`);

    const posTxId = posOrder.data?.transaction_id;
    if (posTxId) {
      // Get transaction details
      const txDetail = await request('GET', `/pos/transactions/${posTxId}`, null, token);
      check('GET Transaction Detail', txDetail.status === 200, `${txDetail.status}`);

      // Complete it
      const compRes = await request('PUT', `/pos/orders/${posTxId}/complete`, null, token);
      check('Complete POS Order', compRes.status === 200, `${compRes.status} ${compRes.data?.error || ''}`);
    }
  }

  // ============================================
  // 7. CUSTOMIZATIONS
  // ============================================
  console.log('⚙️ 7. CUSTOMIZATIONS');

  const custGroupsRes = await request('GET', '/customizations/groups', null, token);
  check('GET Groups', custGroupsRes.status === 200, `${custGroupsRes.status} count=${Array.isArray(custGroupsRes.data) ? custGroupsRes.data.length : 'N/A'}`);

  const activeGroupsRes = await request('GET', '/customizations/groups/active', null, token);
  check('GET Active Groups', activeGroupsRes.status === 200, `${activeGroupsRes.status}`);

  // Item customizations: /customizations/item/:itemId
  const itemCustRes = await request('GET', '/customizations/item/2', null, token);
  check('GET Item 2 Customizations', itemCustRes.status === 200, `${itemCustRes.status}`);

  // ============================================
  // 8. DISCOUNTS
  // ============================================
  console.log('🏷️ 8. DISCOUNTS');

  if (token) {
    const discRes = await request('GET', '/discounts', null, token);
    check('GET Discounts', discRes.status === 200 && Array.isArray(discRes.data), `${discRes.status} count=${discRes.data?.length}`);
  }

  // ============================================
  // 9. LIBRARY
  // ============================================
  console.log('📚 9. LIBRARY');

  // Public - available seats
  const availSeatsRes = await request('GET', '/library/seats/available');
  check('GET Available Seats (Public)', availSeatsRes.status === 200, `${availSeatsRes.status}`);

  if (token) {
    const seatsRes = await request('GET', '/library/seats', null, token);
    check('GET All Seats', seatsRes.status === 200, `${seatsRes.status}`);

    const historyRes = await request('GET', '/library/history', null, token);
    check('GET Session History', historyRes.status === 200, `${historyRes.status}`);

    const configRes = await request('GET', '/library/config', null, token);
    check('GET Library Config', configRes.status === 200, `${configRes.status}`);
  }

  // ============================================
  // 10. REPORTS
  // ============================================
  console.log('📈 10. REPORTS');

  if (token) {
    const salesRes = await request('GET', '/reports/sales-summary', null, token);
    check('Sales Summary', salesRes.status === 200, `${salesRes.status}`);

    const topRes = await request('GET', '/reports/top-products', null, token);
    check('Top Products', topRes.status === 200, `${topRes.status}`);

    const trendRes = await request('GET', '/reports/sales-trend', null, token);
    check('Sales Trend', trendRes.status === 200, `${trendRes.status}`);

    const catPerfRes = await request('GET', '/reports/category-performance', null, token);
    check('Category Performance', catPerfRes.status === 200, `${catPerfRes.status}`);

    const hourlyRes = await request('GET', '/reports/hourly-sales', null, token);
    check('Hourly Sales', hourlyRes.status === 200, `${hourlyRes.status}`);

    const libStatsRes = await request('GET', '/reports/library-stats', null, token);
    check('Library Stats', libStatsRes.status === 200, `${libStatsRes.status}`);
  }

  // ============================================
  // 11. USERS
  // ============================================
  console.log('👤 11. USERS');

  if (token) {
    const usersRes = await request('GET', '/users', null, token);
    check('GET Users', usersRes.status === 200, `${usersRes.status}`);

    const rolesRes = await request('GET', '/users/meta/roles', null, token);
    check('GET Roles', rolesRes.status === 200, `${rolesRes.status}`);

    const profileRes = await request('GET', '/users/me/profile', null, token);
    check('GET My Profile', profileRes.status === 200, `${profileRes.status}`);
  }

  // ============================================
  // 12. VOID/REFUND
  // ============================================
  console.log('🔄 12. VOID/REFUND HISTORY');

  if (token) {
    const voidedRes = await request('GET', '/pos/transactions/voided', null, token);
    check('GET Voided Transactions', voidedRes.status === 200, `${voidedRes.status}`);

    const refundedRes = await request('GET', '/pos/transactions/refunded', null, token);
    check('GET Refunded Transactions', refundedRes.status === 200, `${refundedRes.status}`);

    const completedRes = await request('GET', '/pos/transactions/completed', null, token);
    check('GET Completed Transactions', completedRes.status === 200, `${completedRes.status}`);
  }

  // ============================================
  // RESULTS
  // ============================================
  console.log('\n' + '═'.repeat(55));
  console.log('  COMPREHENSIVE API TEST RESULTS');
  console.log('═'.repeat(55));
  results.forEach(r => console.log(r));
  console.log('═'.repeat(55));
  console.log(`  PASSED: ${passed}  |  FAILED: ${failed}  |  TOTAL: ${passed + failed}`);
  if (failed === 0) {
    console.log('  🎉 ALL TESTS PASSED! System is ready for defense.');
  } else {
    console.log(`  ⚠️ ${failed} TEST(S) FAILED — review above.`);
  }
  console.log('═'.repeat(55));
})();
