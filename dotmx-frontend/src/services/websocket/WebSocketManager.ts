/**
 * Simplified WebSocket Manager for Trading Applications
 * Clean implementation with minimal logging and error handling
 */

export enum WebSocketState {
  CONNECTING = "CONNECTING",
  CONNECTED = "CONNECTED",
  DISCONNECTED = "DISCONNECTED",
  RECONNECTING = "RECONNECTING",
  ERROR = "ERROR",
  CLOSED = "CLOSED",
}

export interface WebSocketConfig {
  url: string;
  protocols?: string[];
  maxReconnectAttempts?: number;
  reconnectInterval?: number;
  maxReconnectInterval?: number;
  reconnectDecay?: number;
  heartbeatInterval?: number;
  connectionTimeout?: number;
}

export interface WebSocketMessage {
  timestamp: number;
  data: unknown;
}

export interface WebSocketEventHandlers {
  onOpen?: (event: Event) => void;
  onMessage?: (message: WebSocketMessage) => void;
  onError?: (error: Event | Error) => void;
  onClose?: (event: CloseEvent) => void;
  onStateChange?: (state: WebSocketState, prevState: WebSocketState) => void;
}

export class WebSocketManager {
  private ws: WebSocket | null = null;
  private config: Required<Omit<WebSocketConfig, "protocols">> & {
    protocols?: string[];
  };
  private eventHandlers: WebSocketEventHandlers;
  private state: WebSocketState = WebSocketState.DISCONNECTED;
  private reconnectAttempts: number = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private connectionTimer: NodeJS.Timeout | null = null;
  private messageQueue: unknown[] = [];
  private isDestroyed: boolean = false;
  private lastPingTime: number = 0;
  private lastPongTime: number = 0;
  private connectionStartTime: number = 0;

  constructor(
    config: WebSocketConfig,
    eventHandlers: WebSocketEventHandlers = {}
  ) {
    this.config = {
      url: config.url,
      maxReconnectAttempts: config.maxReconnectAttempts ?? 10,
      reconnectInterval: config.reconnectInterval ?? 1000,
      maxReconnectInterval: config.maxReconnectInterval ?? 30000,
      reconnectDecay: config.reconnectDecay ?? 1.5,
      heartbeatInterval: config.heartbeatInterval ?? 25000,
      connectionTimeout: config.connectionTimeout ?? 10000,
      ...(config.protocols && { protocols: config.protocols }),
    };
    this.eventHandlers = eventHandlers;
  }

  private logError(message: string, ...args: unknown[]): void {
    // Filter out empty objects and undefined/null values
    const filteredArgs = args.filter((arg) => {
      if (arg === null || arg === undefined) return false;
      if (typeof arg === "object") {
        // For objects, check if they have meaningful content
        if (Array.isArray(arg)) {
          return arg.length > 0;
        }
        // For regular objects, check if they have enumerable properties
        return Object.keys(arg).length > 0;
      }
      return true;
    });

    if (filteredArgs.length > 0) {
      console.error(`[WebSocketManager] ${message}`, ...filteredArgs);
    } else {
      console.error(`[WebSocketManager] ${message}`);
    }
  }

  private setState(newState: WebSocketState): void {
    if (newState === this.state) return;
    const prevState = this.state;
    this.state = newState;
    this.eventHandlers.onStateChange?.(newState, prevState);
  }

  private startConnectionTimeout(): void {
    this.clearConnectionTimeout();
    this.connectionTimer = setTimeout(() => {
      this.logError("Connection timeout");
      this.handleConnectionError(new Error("Connection timeout"));
    }, this.config.connectionTimeout);
  }

  private clearConnectionTimeout(): void {
    if (this.connectionTimer) {
      clearTimeout(this.connectionTimer);
      this.connectionTimer = null;
    }
  }

  private startHeartbeat(): void {
    this.clearHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.state === WebSocketState.CONNECTED && this.ws) {
        this.lastPingTime = Date.now();
        this.ws.send("ping");
      }
      this.check24HourLimit();
    }, this.config.heartbeatInterval);
  }

  private clearHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private handlePong(): void {
    this.lastPongTime = Date.now();
  }

  private check24HourLimit(): void {
    if (this.connectionStartTime > 0) {
      const connectionAge = Date.now() - this.connectionStartTime;
      const twentyThreeHours = 23 * 60 * 60 * 1000;

      if (connectionAge > twentyThreeHours) {
        this.disconnect();
        this.connect().catch((error) => {
          this.logError("Failed to reconnect for 24-hour limit", error);
        });
      }
    }
  }

  public connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.isDestroyed) {
        reject(new Error("WebSocketManager has been destroyed"));
        return;
      }

      if (
        this.state === WebSocketState.CONNECTED ||
        this.state === WebSocketState.CONNECTING
      ) {
        resolve();
        return;
      }

      this.setState(WebSocketState.CONNECTING);
      this.startConnectionTimeout();

      try {
        this.ws = new WebSocket(this.config.url, this.config.protocols);
        this.setupEventListeners(resolve, reject);
      } catch (error) {
        this.clearConnectionTimeout();
        this.setState(WebSocketState.ERROR);
        this.logError("Failed to create WebSocket", error);
        reject(error);
      }
    });
  }

  private setupEventListeners(
    resolve: () => void,
    reject: (error: unknown) => void
  ): void {
    if (!this.ws) return;

    this.ws.onopen = (event: Event) => {
      this.clearConnectionTimeout();
      this.setState(WebSocketState.CONNECTED);
      this.reconnectAttempts = 0;
      this.connectionStartTime = Date.now();
      this.lastPongTime = Date.now();
      this.lastPingTime = 0;
      this.startHeartbeat();
      this.flushMessageQueue();
      this.eventHandlers.onOpen?.(event);
      resolve();
    };

    this.ws.onmessage = (event: MessageEvent) => {
      try {
        if (event.data === "pong") {
          this.handlePong();
          return;
        }

        const data = JSON.parse(event.data);

        if (data.type === "pong" || data.pong) {
          this.handlePong();
          return;
        }

        const message: WebSocketMessage = {
          timestamp: Date.now(),
          data,
        };

        this.eventHandlers.onMessage?.(message);
      } catch (error) {
        this.logError("Failed to parse message", error, event.data);
        this.eventHandlers.onError?.(error as Error);
      }
    };

    this.ws.onerror = (event: Event) => {
      this.handleConnectionError(event);
      reject(event);
    };

    this.ws.onclose = (event: CloseEvent) => {
      this.clearConnectionTimeout();
      this.clearHeartbeat();
      this.setState(WebSocketState.DISCONNECTED);
      this.eventHandlers.onClose?.(event);

      if (!this.isDestroyed && !event.wasClean && event.code !== 1000) {
        this.scheduleReconnect();
      }
    };
  }

  private handleConnectionError(error: Event | Error): void {
    this.setState(WebSocketState.ERROR);
    this.eventHandlers.onError?.(error);

    if (!this.isDestroyed) {
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      this.logError("Max reconnection attempts reached");
      this.setState(WebSocketState.ERROR);
      return;
    }

    const delay = Math.min(
      this.config.reconnectInterval *
        Math.pow(this.config.reconnectDecay, this.reconnectAttempts),
      this.config.maxReconnectInterval
    );

    this.setState(WebSocketState.RECONNECTING);
    this.reconnectAttempts++;

    this.reconnectTimer = setTimeout(() => {
      this.connect().catch((error) => {
        this.logError("Reconnection failed", error);
      });
    }, delay);
  }

  private flushMessageQueue(): void {
    while (
      this.messageQueue.length > 0 &&
      this.state === WebSocketState.CONNECTED
    ) {
      const message = this.messageQueue.shift();
      this.send(message, false);
    }
  }

  public send(data: unknown, queueIfDisconnected: boolean = true): boolean {
    if (this.isDestroyed) {
      return false;
    }

    if (this.state !== WebSocketState.CONNECTED) {
      if (queueIfDisconnected) {
        this.messageQueue.push(data);
        return true;
      }
      return false;
    }

    try {
      const message = typeof data === "string" ? data : JSON.stringify(data);
      this.ws?.send(message);
      return true;
    } catch (error) {
      this.logError("Failed to send message", error);
      this.eventHandlers.onError?.(error as Error);
      return false;
    }
  }

  public disconnect(
    code: number = 1000,
    reason: string = "Client disconnect"
  ): void {
    this.clearReconnectTimer();
    this.clearHeartbeat();
    this.clearConnectionTimeout();

    if (this.ws) {
      this.ws.close(code, reason);
      this.ws = null;
    }

    this.setState(WebSocketState.CLOSED);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  public destroy(): void {
    this.isDestroyed = true;
    this.disconnect();
    this.clearReconnectTimer();
    this.messageQueue.length = 0;
  }

  public getState(): WebSocketState {
    return this.state;
  }

  public isConnected(): boolean {
    return this.state === WebSocketState.CONNECTED;
  }

  public getQueuedMessageCount(): number {
    return this.messageQueue.length;
  }

  public getReconnectAttempts(): number {
    return this.reconnectAttempts;
  }

  public getLatency(): number {
    return this.lastPongTime > this.lastPingTime && this.lastPingTime > 0
      ? this.lastPongTime - this.lastPingTime
      : 0;
  }

  public getConnectionId(): string {
    return `ws_${this.connectionStartTime}_${this.state}`;
  }

  public updateConfig(newConfig: Partial<WebSocketConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}
