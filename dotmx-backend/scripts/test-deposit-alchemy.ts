#!/usr/bin/env bun
/**
 * Test: Generate a deposit address and verify it appears in Alchemy webhook
 * 
 * 1. Login 
 * 2. Generate deposit address on SEP
 * 3. Check Alchemy webhook for the address
 */

const API_URL = 'http://localhost:3001';
const ALCHEMY_API = 'https://dashboard.alchemy.com/api';
const ALCHEMY_TOKEN = process.env.ALCHEMY_API_KEY || '8WYKqqjVYljSVW3unqGbAHci9nb1lpcL';

async function main() {
  console.log('=== Test: Deposit Address → Alchemy Webhook ===\n');

  // 1. Login
  console.log('1. Logging in...');
  const loginRes = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@dotmx.xyz', password: 'Admin@123!' }),
  });

  if (!loginRes.ok) {
    console.error('❌ Login failed:', await loginRes.text());
    process.exit(1);
  }

  const loginData = await loginRes.json() as any;
  const token = loginData.token || loginData.access_token || loginData.tokens?.access_token || loginData.tokens?.accessToken;
  if (!token) {
    console.error('❌ No token in login response. Keys:', Object.keys(loginData));
    if (loginData.tokens) console.error('   tokens keys:', Object.keys(loginData.tokens));
    process.exit(1);
  }
  console.log(`   ✅ Got token: ${token.substring(0, 20)}...`);

  // 2. Generate deposit address on SEP via wallet endpoint
  console.log('\n2. Generating deposit address on SEP...');
  const depositRes = await fetch(`${API_URL}/wallet/deposit-address`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ chain_code: 'SEP' }),
  });

  if (!depositRes.ok) {
    console.error('❌ Deposit address generation failed:', depositRes.status, await depositRes.text());
    process.exit(1);
  }

  const depositData = await depositRes.json() as any;
  if (depositData.error) {
    console.error('❌ Deposit address error:', JSON.stringify(depositData));
    process.exit(1);
  }
  console.log(`   ✅ Address: ${depositData.address}`);
  console.log(`   ✅ Is new: ${depositData.is_new}`);

  // 3. Check Alchemy SEP webhook for the address  
  console.log('\n3. Checking Alchemy SEP webhook...');
  const webhookId = 'wh_72jgslyb1oz37h4d';
  
  const webhookRes = await fetch(`${ALCHEMY_API}/team-webhooks`, {
    headers: { 'X-Alchemy-Token': ALCHEMY_TOKEN },
  });

  if (!webhookRes.ok) {
    console.error('❌ Failed to list webhooks:', await webhookRes.text());
    process.exit(1);
  }

  const { data: webhooks } = await webhookRes.json() as any;
  const sepWebhook = webhooks.find((w: any) => w.id === webhookId);
  
  if (!sepWebhook) {
    console.error('❌ SEP webhook not found');
    process.exit(1);
  }

  // Get webhook addresses
  const addrRes = await fetch(`${ALCHEMY_API}/webhook-addresses?webhook_id=${webhookId}&limit=100`, {
    headers: { 'X-Alchemy-Token': ALCHEMY_TOKEN },
  });

  if (!addrRes.ok) {
    console.error('❌ Failed to get webhook addresses:', await addrRes.text());
    process.exit(1);
  }

  const addrData = await addrRes.json() as any;
  const addresses = addrData.data || [];
  
  console.log(`   Webhook ${webhookId} has ${addresses.length} monitored addresses:`);
  for (const addr of addresses) {
    console.log(`   - ${addr}`);
  }

  const depositAddr = depositData.address?.toLowerCase();
  const found = addresses.some((a: string) => a.toLowerCase() === depositAddr);
  
  if (found) {
    console.log(`\n🎉 SUCCESS: Deposit address ${depositData.address} is registered with Alchemy!`);
  } else {
    console.log(`\n⚠️  Address ${depositData.address} NOT found in Alchemy webhook yet.`);
    console.log('   (If this is an existing address, it may not have been re-registered.)');
    console.log('   Try deleting existing deposit addresses and regenerating.');
  }
}

main().catch(console.error);
