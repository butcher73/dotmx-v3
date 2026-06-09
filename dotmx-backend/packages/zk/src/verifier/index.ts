/**
 * ZK Verifier
 *
 * Verifies zero-knowledge proofs on-chain and off-chain.
 */

import type { FieldElement } from "../circuits";
import type { Proof } from "../prover";

export interface VerificationResult {
  valid: boolean;
  circuitName: string;
  publicInputs: FieldElement[];
  timestamp: number;
  error?: string;
}

export interface VerifierConfig {
  backend: "groth16" | "plonk" | "stark";
  verifyingKeyPath?: string;
}

export interface Verifier {
  loadVerifyingKey(circuitName: string, key: Uint8Array): void;
  verify(proof: Proof): Promise<VerificationResult>;
  verifyBatch(proofs: Proof[]): Promise<VerificationResult[]>;
}

/**
 * Create mock verifier for development/testing
 */
export function createMockVerifier(): Verifier {
  const verifyingKeys = new Map<string, Uint8Array>();

  return {
    loadVerifyingKey(circuitName: string, key: Uint8Array): void {
      verifyingKeys.set(circuitName, key);
    },

    async verify(proof: Proof): Promise<VerificationResult> {
      // Mock verification - always succeeds if key exists
      const hasKey = verifyingKeys.has(proof.circuitName);

      if (!hasKey) {
        return {
          valid: false,
          circuitName: proof.circuitName,
          publicInputs: proof.publicInputs,
          timestamp: Date.now(),
          error: "Verifying key not found",
        };
      }

      // Simulate verification time
      await new Promise((resolve) => setTimeout(resolve, 1));

      return {
        valid: true,
        circuitName: proof.circuitName,
        publicInputs: proof.publicInputs,
        timestamp: Date.now(),
      };
    },

    async verifyBatch(proofs: Proof[]): Promise<VerificationResult[]> {
      return Promise.all(proofs.map((p) => this.verify(p)));
    },
  };
}

/**
 * On-chain verifier contract interface
 */
export interface OnChainVerifier {
  contractAddress: string;
  chainId: number;
  verify(proof: Proof): Promise<{ txHash: string; gasUsed: bigint }>;
  estimateGas(proof: Proof): Promise<bigint>;
}

export function createOnChainVerifier(
  contractAddress: string,
  chainId: number
): OnChainVerifier {
  return {
    contractAddress,
    chainId,

    async verify(proof: Proof) {
      // Would call the smart contract
      // For now, return mock response
      return {
        txHash: `0x${Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join("")}`,
        gasUsed: BigInt(250000),
      };
    },

    async estimateGas(proof: Proof): Promise<bigint> {
      // Groth16 verification is ~250k gas
      // PLONK is ~300k gas
      return BigInt(250000);
    },
  };
}

/**
 * Verification cache to avoid re-verifying
 */
export interface VerificationCache {
  get(proofHash: string): VerificationResult | null;
  set(proofHash: string, result: VerificationResult): void;
  has(proofHash: string): boolean;
}

export function createVerificationCache(maxSize: number = 10000): VerificationCache {
  const cache = new Map<string, VerificationResult>();
  const accessOrder: string[] = [];

  return {
    get(proofHash: string): VerificationResult | null {
      const result = cache.get(proofHash);
      if (result) {
        // Update access order
        const idx = accessOrder.indexOf(proofHash);
        if (idx !== -1) {
          accessOrder.splice(idx, 1);
          accessOrder.push(proofHash);
        }
      }
      return result ?? null;
    },

    set(proofHash: string, result: VerificationResult): void {
      // Evict oldest if full
      while (cache.size >= maxSize) {
        const oldest = accessOrder.shift();
        if (oldest) cache.delete(oldest);
      }

      cache.set(proofHash, result);
      accessOrder.push(proofHash);
    },

    has(proofHash: string): boolean {
      return cache.has(proofHash);
    },
  };
}

/**
 * Hash proof for caching
 */
export function hashProof(proof: Proof): string {
  const data = [
    proof.circuitName,
    ...proof.publicInputs.map((i) => i.toString()),
    Array.from(proof.proofData).join(","),
  ].join("|");

  // Simple hash for cache key
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(16);
}

/**
 * Cached verifier wrapper
 */
export function createCachedVerifier(
  verifier: Verifier,
  cache: VerificationCache
): Verifier {
  return {
    loadVerifyingKey: verifier.loadVerifyingKey.bind(verifier),

    async verify(proof: Proof): Promise<VerificationResult> {
      const proofHash = hashProof(proof);

      const cached = cache.get(proofHash);
      if (cached) {
        return cached;
      }

      const result = await verifier.verify(proof);
      cache.set(proofHash, result);
      return result;
    },

    async verifyBatch(proofs: Proof[]): Promise<VerificationResult[]> {
      return Promise.all(proofs.map((p) => this.verify(p)));
    },
  };
}
