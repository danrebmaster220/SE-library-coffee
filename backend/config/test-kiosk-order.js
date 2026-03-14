const https = require('https');

const data = JSON.stringify({
  order_type: 'dine-in',
  items: [
    {
      item_id: 2,
      item_name: 'Americano',
      quantity: 1,
      unit_price: 150,
      total_price: 150,
      customizations: []
    }
  ],
  subtotal: 150,
  total_amount: 150
});

const options = {
  hostname: 'library-coffee-api.onrender.com',
  path: '/api/pos/kiosk/order',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data)
  }
};

const req = https.request(options, (res) => {
  let body = '';
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => {
    console.log(`Status: ${res.statusCode}`);
    console.log(`Response: ${body}`);
  });
});

req.on('error', (e) => console.error(`Error: ${e.message}`));
req.write(data);
req.end();
