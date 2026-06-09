/**
 * Test HD Wallet address derivation
 * Verifies that real addresses are being generated
 */

import { DatabaseService } from '../packages/shared/src/services/database';
import { GCPKMSService } from '../packages/shared/src/services/gcp-kms.service';
import { HDWalletService } from '../packages/shared/src/services/hd-wallet.service';

async function main() {
  console.log('🔍 Testing HD Wallet Address Derivation\n');

  const db = new DatabaseService({
    connection_string: process.env.DATABASE_URL || 'postgresql://dotmx@localhost:5432/dotmx',
  });

  const kms = new GCPKMSService(db, {
    project_id: process.env.GCP_PROJECT_ID!,
    location: process.env.GCP_KMS_LOCATION!,
    key_ring: process.env.GCP_KMS_KEYRING!,
    key_name: process.env.GCP_KMS_KEY_NAME!,
  });

  const hdWallet = new HDWalletService(db, kms);

  try {
    // Check if wallet is initialized
    const health = await hdWallet.healthCheck();
    console.log('Wallet Health:', health);
    console.log('');

    if (!health.healthy) {
      console.error('❌ Wallet is not healthy. Run scripts/init-hd-wallet.ts first.');
      process.exit(1);
    }

    // Test address derivation for index 0
    console.log('Testing address derivation at index 0:');
    const testPath = 'm/44\'/60\'/0\'/0/0';
    const testUser = '550e8400-e29b-41d4-a716-446655440002';
    
    // Try to generate an address
    console.log('Generating address for SEP chain...');
    const result = await hdWallet.getOrCreateDepositAddress({
      user_id: testUser,
      chain_code: 'SEP',
    });

    console.log('Generated Address:', result.address);
    console.log('Derivation Path:', result.derivation_path);
    console.log('Derivation Index:', result.derivation_index);
    console.log('');

    // Verify it's a real Ethereum address
    if (result.address.startsWith('0x') && result.address.length === 42) {
      const hexRegex = /^0x[0-9a-fA-F]{40}$/;
      if (hexRegex.test(result.address)) {
        console.log('✅ Valid Ethereum address generated!');
      } else {
        console.log('❌ Invalid address format (contains non-hex characters)');
      }
    } else {
      console.log('❌ Invalid address format (wrong length or prefix)');
    }

  } catch (error) {
    console.error('❌ Error:', (error as Error).message);
    if (error instanceof Error && error.stack) {
      console.error(error.stack);
    }
  } finally {
    await db.close();
  }
}

main();
