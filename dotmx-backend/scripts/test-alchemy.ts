/**
 * Test Alchemy API - List webhooks and add address
 * Usage: bun run scripts/test-alchemy.ts
 */

const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY || 'lA0YzVX9eAbYWjxl5F8os';
const ALCHEMY_BASE_URL = 'https://dashboard.alchemy.com/api';
const WEBHOOK_ID = process.env.ALCHEMY_WEBHOOK_ID || 'wh_72jgslyb1oz37h4d';

async function main() {
  console.log('=== Alchemy API Test ===');
  console.log(`API Key: ${ALCHEMY_API_KEY.slice(0, 6)}...`);
  console.log(`Webhook ID: ${WEBHOOK_ID}`);
  console.log('');

  // Step 1: List webhooks
  console.log('--- Step 1: List webhooks ---');
  try {
    const listRes = await fetch(`${ALCHEMY_BASE_URL}/team-webhooks`, {
      headers: { 'X-Alchemy-Token': ALCHEMY_API_KEY },
    });
    console.log(`Status: ${listRes.status}`);
    const listData = await listRes.json();
    console.log(`Webhooks found: ${listData.data?.length || 0}`);
    if (listData.data) {
      for (const wh of listData.data) {
        console.log(`  - ID: ${wh.id}, Network: ${wh.network}, Type: ${wh.webhook_type}, Active: ${wh.is_active}`);
        console.log(`    URL: ${wh.webhook_url}`);
        console.log(`    Addresses: ${wh.addresses?.length || 0}`);
      }
    } else {
      console.log('Response:', JSON.stringify(listData, null, 2));
    }
  } catch (err) {
    console.error('Error listing webhooks:', err);
  }

  console.log('');

  // Step 2: Try to add a test address to the existing webhook
  const testAddress = '0x1234567890abcdef1234567890abcdef12345678';
  console.log(`--- Step 2: Add test address ${testAddress} ---`);
  try {
    const addRes = await fetch(`${ALCHEMY_BASE_URL}/update-webhook-addresses`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-Alchemy-Token': ALCHEMY_API_KEY,
      },
      body: JSON.stringify({
        webhook_id: WEBHOOK_ID,
        addresses_to_add: [testAddress],
        addresses_to_remove: [],
      }),
    });
    console.log(`Status: ${addRes.status}`);
    const addData = await addRes.text();
    console.log(`Response: ${addData}`);
    
    if (addRes.ok) {
      console.log('✅ Successfully added test address!');
      
      // Clean up - remove test address
      console.log('Cleaning up test address...');
      const removeRes = await fetch(`${ALCHEMY_BASE_URL}/update-webhook-addresses`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-Alchemy-Token': ALCHEMY_API_KEY,
        },
        body: JSON.stringify({
          webhook_id: WEBHOOK_ID,
          addresses_to_add: [],
          addresses_to_remove: [testAddress],
        }),
      });
      console.log(`Cleanup status: ${removeRes.status}`);
    } else {
      console.log('❌ Failed to add address');
    }
  } catch (err) {
    console.error('Error adding address:', err);
  }
}

main().catch(console.error);
