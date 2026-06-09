/**
 * ZK Package Tests
 */

import { describe, it, expect, beforeEach } from "bun:test";
import {
  createTradeSettlementCircuit,
  createBalanceUpdateCircuit,
  createBatchProofCircuit,
  createMockProver,
  createBatchProver,
  createMockVerifier,
  createVerificationCache,
} from "../src";
import type { Circuit, FieldElement } from "../src/circuits";

describe("Trade Settlement Circuit", () => {
  it("should create a valid circuit definition", () => {
    const circuit = createTradeSettlementCircuit();

    expect(circuit.name).toBe("TradeSettlement");
    expect(circuit.inputs.length).toBeGreaterThan(0);
    expect(circuit.outputCount).toBe(1);
  });

  it("should have public and private inputs", () => {
    const circuit = createTradeSettlementCircuit();

    const publicInputs = circuit.inputs.filter((i) => i.type === "public");
    const privateInputs = circuit.inputs.filter((i) => i.type === "private");

    expect(publicInputs.length).toBeGreaterThan(0);
    expect(privateInputs.length).toBeGreaterThan(0);
  });

  it("should include price and quantity as public inputs", () => {
    const circuit = createTradeSettlementCircuit();

    const priceInput = circuit.inputs.find((i) => i.name === "price");
    const qtyInput = circuit.inputs.find((i) => i.name === "quantity");

    expect(priceInput).toBeDefined();
    expect(priceInput!.type).toBe("public");
    expect(qtyInput).toBeDefined();
    expect(qtyInput!.type).toBe("public");
  });
});

describe("Balance Update Circuit", () => {
  it("should create a valid circuit definition", () => {
    const circuit = createBalanceUpdateCircuit();

    expect(circuit.name).toBe("BalanceUpdate");
    expect(circuit.inputs.length).toBeGreaterThan(0);
  });

  it("should include balance hashes as public inputs", () => {
    const circuit = createBalanceUpdateCircuit();

    const oldHash = circuit.inputs.find((i) => i.name === "oldBalanceHash");
    const newHash = circuit.inputs.find((i) => i.name === "newBalanceHash");

    expect(oldHash).toBeDefined();
    expect(oldHash!.type).toBe("public");
    expect(newHash).toBeDefined();
    expect(newHash!.type).toBe("public");
  });

  it("should have actual balance as private input", () => {
    const circuit = createBalanceUpdateCircuit();

    const oldBalance = circuit.inputs.find((i) => i.name === "oldBalance");
    const newBalance = circuit.inputs.find((i) => i.name === "newBalance");

    expect(oldBalance).toBeDefined();
    expect(oldBalance!.type).toBe("private");
    expect(newBalance).toBeDefined();
    expect(newBalance!.type).toBe("private");
  });
});

describe("Batch Proof Circuit", () => {
  it("should create batch proof circuit", () => {
    const circuit = createBatchProofCircuit(10);

    expect(circuit.name).toBe("BatchProof");
    expect(circuit.inputs.length).toBeGreaterThan(0);
  });
});

describe("Mock Prover", () => {
  let prover: ReturnType<typeof createMockProver>;
  let circuit: Circuit;

  beforeEach(() => {
    prover = createMockProver();
    circuit = createTradeSettlementCircuit();
  });

  it("should setup circuit and generate keys", async () => {
    const { provingKey, verifyingKey } = await prover.setup(circuit);

    expect(provingKey).toBeInstanceOf(Uint8Array);
    expect(provingKey.length).toBeGreaterThan(0);
    expect(verifyingKey).toBeInstanceOf(Uint8Array);
    expect(verifyingKey.length).toBeGreaterThan(0);
  });

  it("should generate proof", async () => {
    await prover.setup(circuit);

    const inputs = new Map<string, FieldElement>([
      ["tradeHash", 123n],
      ["makerCommitment", 456n],
      ["takerCommitment", 789n],
      ["price", 50000n],
      ["quantity", 1n],
    ]);

    const proof = await prover.prove(circuit, inputs);

    expect(proof.circuitName).toBe("TradeSettlement");
    expect(proof.proofData).toBeInstanceOf(Uint8Array);
    expect(proof.publicInputs.length).toBeGreaterThan(0);
    expect(proof.timestamp).toBeGreaterThan(0);
  });

  it("should retrieve proving key after setup", async () => {
    await prover.setup(circuit);

    const key = prover.getProvingKey(circuit.name);
    expect(key).not.toBeNull();
    expect(key!.length).toBeGreaterThan(0);
  });

  it("should return null for unknown circuit", () => {
    const key = prover.getProvingKey("NonExistentCircuit");
    expect(key).toBeNull();
  });
});

describe("Batch Prover", () => {
  let batchProver: ReturnType<typeof createBatchProver>;
  let baseProver: ReturnType<typeof createMockProver>;
  let circuit: Circuit;

  beforeEach(async () => {
    baseProver = createMockProver();
    batchProver = createBatchProver(baseProver);
    circuit = createTradeSettlementCircuit();
    await baseProver.setup(circuit);
  });

  it("should add proof to queue", () => {
    const inputs = new Map<string, FieldElement>([["price", 50000n]]);
    batchProver.addProof(circuit, inputs);
    // No exception thrown = success
  });

  it("should prove batch of proofs", async () => {
    const inputs1 = new Map<string, FieldElement>([["price", 50000n]]);
    const inputs2 = new Map<string, FieldElement>([["price", 51000n]]);

    batchProver.addProof(circuit, inputs1);
    batchProver.addProof(circuit, inputs2);

    const results = await batchProver.proveBatch();

    expect(results.length).toBe(2);
    results.forEach((proof) => {
      expect(proof.circuitName).toBe("TradeSettlement");
      expect(proof.proofData).toBeInstanceOf(Uint8Array);
    });
  });

  it("should clear queue after proving", async () => {
    const inputs = new Map<string, FieldElement>([["price", 50000n]]);
    batchProver.addProof(circuit, inputs);

    await batchProver.proveBatch();
    batchProver.clear();

    const results = await batchProver.proveBatch();
    expect(results.length).toBe(0);
  });
});

describe("Mock Verifier", () => {
  let verifier: ReturnType<typeof createMockVerifier>;
  let prover: ReturnType<typeof createMockProver>;
  let circuit: Circuit;

  beforeEach(async () => {
    verifier = createMockVerifier();
    prover = createMockProver();
    circuit = createTradeSettlementCircuit();

    const { verifyingKey } = await prover.setup(circuit);
    verifier.loadVerifyingKey(circuit.name, verifyingKey);
  });

  it("should verify valid proof", async () => {
    const inputs = new Map<string, FieldElement>([
      ["price", 50000n],
      ["quantity", 1n],
    ]);

    const proof = await prover.prove(circuit, inputs);
    const result = await verifier.verify(proof);

    expect(result.valid).toBe(true);
    expect(result.circuitName).toBe("TradeSettlement");
  });

  it("should reject proof for unknown circuit", async () => {
    const proof = {
      circuitName: "UnknownCircuit",
      publicInputs: [1n],
      proofData: new Uint8Array([1, 2, 3]),
      timestamp: Date.now(),
    };

    const result = await verifier.verify(proof);

    expect(result.valid).toBe(false);
    expect(result.error).toContain("Verifying key not found");
  });

  it("should verify batch of proofs", async () => {
    const inputs = new Map<string, FieldElement>([["price", 50000n]]);

    const proof1 = await prover.prove(circuit, inputs);
    const proof2 = await prover.prove(circuit, inputs);

    const results = await verifier.verifyBatch([proof1, proof2]);

    expect(results.length).toBe(2);
    results.forEach((r) => expect(r.valid).toBe(true));
  });
});

describe("Verification Cache", () => {
  let cache: ReturnType<typeof createVerificationCache>;

  beforeEach(() => {
    cache = createVerificationCache();
  });

  it("should cache verification results", () => {
    const proofHash = "proof-hash-123";
    const verificationResult = {
      valid: true,
      circuitName: "TradeSettlement",
      publicInputs: [1n, 2n],
      timestamp: Date.now(),
    };

    // First call - not cached
    let result = cache.get(proofHash);
    expect(result).toBeNull();

    // Set cache
    cache.set(proofHash, verificationResult);

    // Second call - cached
    result = cache.get(proofHash);
    expect(result).not.toBeNull();
    expect(result!.valid).toBe(true);
    expect(result!.circuitName).toBe("TradeSettlement");
  });

  it("should handle different proofs separately", () => {
    const result1 = { valid: true, circuitName: "C1", publicInputs: [1n], timestamp: Date.now() };
    const result2 = { valid: false, circuitName: "C2", publicInputs: [2n], timestamp: Date.now() };

    cache.set("proof1", result1);
    cache.set("proof2", result2);

    expect(cache.get("proof1")!.valid).toBe(true);
    expect(cache.get("proof2")!.valid).toBe(false);
  });

  it("should check if proof exists", () => {
    expect(cache.has("unknown")).toBe(false);

    cache.set("proof1", { valid: true, circuitName: "C", publicInputs: [], timestamp: Date.now() });

    expect(cache.has("proof1")).toBe(true);
  });
});
