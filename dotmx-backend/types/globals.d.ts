/**
 * Global type declarations for the DotMX backend
 */

// Bun runtime types
declare module "bun:test" {
  export function describe(name: string, fn: () => void): void;
  export function it(name: string, fn: () => void | Promise<void>): void;
  export function test(name: string, fn: () => void | Promise<void>): void;
  export function expect<T>(value: T): {
    toBe(expected: T): void;
    toEqual(expected: T): void;
    toBeDefined(): void;
    toBeUndefined(): void;
    toBeNull(): void;
    toBeTruthy(): void;
    toBeFalsy(): void;
    toBeGreaterThan(expected: number): void;
    toBeGreaterThanOrEqual(expected: number): void;
    toBeLessThan(expected: number): void;
    toBeLessThanOrEqual(expected: number): void;
    toContain(expected: unknown): void;
    toHaveLength(expected: number): void;
    toBeCloseTo(expected: number, precision?: number): void;
    toThrow(expected?: string | RegExp | Error): void;
    not: {
      toBe(expected: T): void;
      toEqual(expected: T): void;
      toBeDefined(): void;
      toBeNull(): void;
      toContain(expected: unknown): void;
    };
  };
  export function beforeEach(fn: () => void | Promise<void>): void;
  export function afterEach(fn: () => void | Promise<void>): void;
  export function beforeAll(fn: () => void | Promise<void>): void;
  export function afterAll(fn: () => void | Promise<void>): void;
}

// NATS module stub
declare module "nats" {
  export interface ConnectionOptions {
    servers?: string | string[];
    token?: string;
    user?: string;
    pass?: string;
    name?: string;
  }
  
  export interface NatsConnection {
    jetstream(): JetStreamClient;
    close(): Promise<void>;
  }
  
  export interface JetStreamClient {
    publish(subject: string, data?: Uint8Array): Promise<unknown>;
    subscribe(subject: string): Promise<JetStreamSubscription>;
  }
  
  export interface JetStreamSubscription {
    [Symbol.asyncIterator](): AsyncIterator<JetStreamMessage>;
    unsubscribe(): void;
  }
  
  export interface JetStreamMessage {
    data: Uint8Array;
    ack(): void;
    nak(): void;
  }
  
  export function connect(options?: ConnectionOptions): Promise<NatsConnection>;
}

// Redis module stub
declare module "redis" {
  export interface RedisClientOptions {
    url?: string;
  }
  
  export interface RedisClient {
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    publish(channel: string, message: string): Promise<number>;
    subscribe(channel: string, callback: (message: string) => void): Promise<void>;
    pSubscribe(pattern: string, callback: (message: string, channel: string) => void): Promise<void>;
    duplicate(): RedisClient;
  }
  
  export function createClient(options?: RedisClientOptions): RedisClient;
}

// Elysia module stub
declare module "elysia" {
  export class Elysia<Path extends string = ""> {
    constructor(options?: { name?: string; prefix?: string });
    use(plugin: unknown): this;
    get(path: string, handler: unknown, options?: unknown): this;
    post(path: string, handler: unknown, options?: unknown): this;
    put(path: string, handler: unknown, options?: unknown): this;
    delete(path: string, handler: unknown, options?: unknown): this;
    ws(path: string, options: unknown): this;
    listen(port: number | { port: number; hostname?: string }): Promise<this>;
    stop(): Promise<void>;
    group(prefix: string, fn: (app: Elysia) => Elysia): this;
  }
  
  export const t: {
    String(): unknown;
    Number(): unknown;
    Boolean(): unknown;
    Object(schema: Record<string, unknown>): unknown;
    Array(schema: unknown): unknown;
    Optional(schema: unknown): unknown;
    Union(schemas: unknown[]): unknown;
    Literal(value: unknown): unknown;
  };
}
