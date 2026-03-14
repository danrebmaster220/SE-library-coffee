const https = require('https');

function request(method, path, token) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'library-coffee-api.onrender.com',
      path: '/api' + path,
      method,
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
    };
    const req = https.request(options, (res) => {
      let result = '';
      res.on('data', (chunk) => result += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: result }));
    });
    req.on('error', reject);
    req.end();
  });
}

(async () => {
  // Login first
  const loginRes = await new Promise((resolve, reject) => {
    const data = JSON.stringify({ username: 'admin', password: 'password123' });
    const options = {
      hostname: 'library-coffee-api.onrender.com',
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
    };
    const req = https.request(options, (res) => {
      let result = '';
      res.on('data', (chunk) => result += chunk);
      res.on('end', () => resolve(JSON.parse(result)));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });

  const token = loginRes.token;

  // Test the 2 failing endpoints
  console.log('=== Top Products ===');
  const r1 = await request('GET', '/reports/top-products', token);
  console.log(`Status: ${r1.status}`);
  console.log(`Body: ${r1.body.substring(0, 500)}`);

  console.log('\n=== Category Performance ===');
  const r2 = await request('GET', '/reports/category-performance', token);
  console.log(`Status: ${r2.status}`);
  console.log(`Body: ${r2.body.substring(0, 500)}`);
})();
