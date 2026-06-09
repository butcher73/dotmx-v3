/**
 * Exchange Client Tests
 *
 * Tests auth header generation, URL building, and request tracking.
 * Does NOT make real HTTP calls — tests internal logic only.
 */

import { describe, test, expect, beforeEach } from "bun:test";
import { ExchangeClient } from "../src/exchange-client";

describe("ExchangeClient", () => {
  let client: ExchangeClient;

  beforeEach(() => {
    client = new ExchangeClient("http://localhost:8080/api");
  });

  // ─── Auth Headers ──────────────────────────────────────────

  test("authHeaders returns X-API-Key when API key is set", () => {
    client.setApiKey("dmx_test123");
    const headers = (client as any).authHeaders();
    expect(headers["X-API-Key"]).toBe("dmx_test123");
    expect(headers["Authorization"]).toBeUndefined();
  });

  test("authHeaders returns empty when no auth configured", () => {
    const headers = (client as any).authHeaders();
    expect(Object.keys(headers)).toHaveLength(0);
  });

  test("setApiKey clears JWT auth", () => {
    // Simulate JWT being set
    (client as any).accessToken = "jwt_token";
    client.setApiKey("dmx_test123");
    expect((client as any).accessToken).toBeNull();
    expect((client as any).apiKey).toBe("dmx_test123");
  });

  // ─── Request Tracking ─────────────────────────────────────

  test("requestsPerMinute starts at 0", () => {
    expect(client.requestsPerMinute).toBe(0);
  });

  test("trackRequest increments counter", () => {
    (client as any).trackRequest();
    (client as any).trackRequest();
    (client as any).trackRequest();
    expect(client.requestsPerMinute).toBe(3);
  });

  // ─── URL Construction ─────────────────────────────────────

  test("rawFetch constructs correct URL", () => {
    // We can't test the actual fetch, but verify baseUrl is used
    expect((client as any).baseUrl).toBe("http://localhost:8080/api");
  });

  test("custom baseUrl is used", () => {
    const custom = new ExchangeClient("https://api.dotmx.exchange/api");
    expect((custom as any).baseUrl).toBe("https://api.dotmx.exchange/api");
  });
});
