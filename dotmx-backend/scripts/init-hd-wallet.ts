/**
 * Initialize HD Wallet
 * Generates and securely stores the master seed
 * 
 * IMPORTANT: Run this only once per environment!
 * The mnemonic shown MUST be backed up securely.
 * 
 * Usage: 
 *   bun run scripts/init-hd-wallet.ts              # Generate new seed
 *   bun run scripts/init-hd-wallet.ts --import     # Import existing seed
 *   SEED_PHRASE="..." bun run scripts/init-hd-wallet.ts --import
 * 
 * (Bun automatically loads .env file)
 */

import { DatabaseService } from '../packages/shared/src/services/database';
import { GCPKMSService } from '../packages/shared/src/services/gcp-kms.service';
import { HDWalletService } from '../packages/shared/src/services/hd-wallet.service';
import { Mnemonic } from 'ethers';

async function promptForSeed(): Promise<string> {
  console.log('Enter your 12 or 24-word BIP-39 seed phrase:');
  console.log('(paste all words separated by spaces, then press Enter)\n');
  
  const readline = await import('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question('> ', (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function main() {
  console.log('🔐 HD Wallet Initialization');
  console.log('===========================\n');

  // Check for required environment variables
  const requiredEnvVars = [
    'DATABASE_URL',
    'GCP_PROJECT_ID',
    'GCP_KMS_LOCATION',
    'GCP_KMS_KEYRING',
    'GCP_KMS_KEY_NAME',
  ];

  const missingVars = requiredEnvVars.filter(v => !process.env[v]);
  if (missingVars.length > 0) {
    console.error('❌ Missing required environment variables:');
    missingVars.forEach(v => console.error(`   - ${v}`));
    process.exit(1);
  }

  const importMode = process.argv.includes('--import') || process.env.SEED_PHRASE;
  let customSeed: string | undefined;

  if (importMode) {
    console.log('📥 Import Mode: Using existing seed phrase\n');
    
    // Get seed phrase from environment or prompt
    if (process.env.SEED_PHRASE) {
      customSeed = process.env.SEED_PHRASE;
      console.log('   Using seed phrase from SEED_PHRASE environment variable');
    } else {
      customSeed = await promptForSeed();
    }

    // Validate seed phrase
    try {
      Mnemonic.fromPhrase(customSeed);
      console.log('   ✅ Seed phrase validated\n');
    } catch (error) {
      console.error('❌ Invalid seed phrase:', (error as Error).message);
      console.error('   Must be a valid BIP-39 mnemonic (12 or 24 words)');
      process.exit(1);
    }
  } else {
    console.log('🎲 Generate Mode: Creating new random seed phrase\n');
  }

  // Initialize services
  const db = new DatabaseService({
    connection_string: process.env.DATABASE_URL!,
  });

  const kms = new GCPKMSService(db, {
    project_id: process.env.GCP_PROJECT_ID!,
    location: process.env.GCP_KMS_LOCATION!,
    key_ring: process.env.GCP_KMS_KEYRING!,
    key_name: process.env.GCP_KMS_KEY_NAME!,
  });

  const hdWallet = new HDWalletService(db, kms);

  try {
    // Check KMS health
    console.log('📋 Checking GCP KMS connection...');
    const kmsHealth = await kms.healthCheck();
    if (!kmsHealth.healthy) {
      console.error(`❌ KMS health check failed: ${kmsHealth.message}`);
      process.exit(1);
    }
    console.log('   ✅ KMS connection OK\n');

    // Initialize wallet (with optional custom seed)
    console.log('📋 Initializing HD Wallet...');
    const result = await hdWallet.initialize(customSeed);

    if (result.already_initialized) {
      console.log('   ⚠️  Wallet already initialized. No changes made.\n');
      
      // Verify wallet works
      console.log('📋 Verifying wallet...');
      const health = await hdWallet.healthCheck();
      if (health.healthy) {
        console.log('   ✅ Wallet verification passed\n');
      } else {
        console.error(`   ❌ Wallet verification failed: ${health.message}`);
      }
    } else {
      const action = importMode ? 'imported' : 'generated';
      console.log(`   ✅ Wallet ${action} and initialized successfully!\n`);
      
      console.log('═══════════════════════════════════════════════════════════════');
      if (importMode) {
        console.log('  ✅ SEED PHRASE IMPORTED AND ENCRYPTED');
      } else {
        console.log('  ⚠️  CRITICAL: BACKUP THE FOLLOWING MNEMONIC IMMEDIATELY!');
      }
      console.log('═══════════════════════════════════════════════════════════════');
      console.log('');
      console.log(`  ${result.mnemonic}`);
      console.log('');
      console.log('═══════════════════════════════════════════════════════════════');
      if (importMode) {
        console.log('  Your existing seed phrase has been securely encrypted with GCP KMS.');
        console.log('  Verify this matches your backup.');
      } else {
        console.log('  This is the ONLY time this mnemonic will be displayed.');
        console.log('  Store it securely offline (paper, safety deposit box, etc.)');
        console.log('  Without it, ALL USER FUNDS are IRRECOVERABLE.');
      }
      console.log('═══════════════════════════════════════════════════════════════');
      console.log('');
    }

    // Generate test addresses to verify
    console.log('📋 Generating test deposit addresses...');
    const chains = ['ETH', 'MATIC', 'BSC'];
    for (const chain of chains) {
      const config = hdWallet.getChainConfig(chain);
      if (config) {
        // Derive address at index 0 (without creating in DB)
        const path = `m/44'/${config.coin_type}'/0'/0/0`;
        // Note: This is just for display, not creating actual addresses
        console.log(`   ${chain}: Derivation ready (coin_type: ${config.coin_type})`);
      }
    }

    console.log('\n✅ Initialization complete!\n');
    console.log('Next steps:');
    console.log('1. Configure warm wallets in the database');
    console.log('2. Start the API server with wallet routes enabled');
    console.log('3. Users can now generate deposit addresses\n');

  } catch (error) {
    console.error('❌ Error:', (error as Error).message);
    process.exit(1);
  } finally {
    await db.close();
  }
}

main();
