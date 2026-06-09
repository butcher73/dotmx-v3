/**
 * Throttle / Rate Limiter
 *
 * Limits update frequency for market data streams.
 * Coalesces rapid updates to reduce bandwidth.
 */

export interface ThrottleConfig {
  intervalMs: number;
  maxQueueSize: number;
}

export const defaultThrottleConfig: ThrottleConfig = {
  intervalMs: 100, // 10 updates/sec max
  maxQueueSize: 100,
};

export interface Throttle<T> {
  push(item: T): void;
  flush(): T[];
  setHandler(handler: (items: T[]) => void): void;
  stop(): void;
}

/**
 * Create a time-based throttle
 * Collects items and flushes at regular intervals
 */
export function createThrottle<T>(
  config: ThrottleConfig = defaultThrottleConfig
): Throttle<T> {
  const queue: T[] = [];
  let handler: ((items: T[]) => void) | null = null;
  let timer: ReturnType<typeof setInterval> | null = null;

  function startTimer() {
    if (timer) return;
    timer = setInterval(() => {
      if (queue.length > 0 && handler) {
        const items = [...queue];
        queue.length = 0;
        handler(items);
      }
    }, config.intervalMs);
  }

  function stopTimer() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  return {
    push(item: T): void {
      if (queue.length >= config.maxQueueSize) {
        queue.shift(); // Drop oldest
      }
      queue.push(item);
    },

    flush(): T[] {
      const items = [...queue];
      queue.length = 0;
      return items;
    },

    setHandler(h: (items: T[]) => void): void {
      handler = h;
      startTimer();
    },

    stop(): void {
      stopTimer();
      handler = null;
    },
  };
}

/**
 * Create a coalescing throttle
 * Keeps only the latest item per key
 */
export function createCoalescingThrottle<T>(
  config: ThrottleConfig,
  keyFn: (item: T) => string
): Throttle<T> {
  const latest = new Map<string, T>();
  let handler: ((items: T[]) => void) | null = null;
  let timer: ReturnType<typeof setInterval> | null = null;

  function startTimer() {
    if (timer) return;
    timer = setInterval(() => {
      if (latest.size > 0 && handler) {
        const items = Array.from(latest.values());
        latest.clear();
        handler(items);
      }
    }, config.intervalMs);
  }

  function stopTimer() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  return {
    push(item: T): void {
      const key = keyFn(item);
      latest.set(key, item);
    },

    flush(): T[] {
      const items = Array.from(latest.values());
      latest.clear();
      return items;
    },

    setHandler(h: (items: T[]) => void): void {
      handler = h;
      startTimer();
    },

    stop(): void {
      stopTimer();
      handler = null;
    },
  };
}

/**
 * Per-symbol throttled stream
 */
export interface ThrottledStream<T> {
  push(symbol: string, item: T): void;
  setHandler(symbol: string, handler: (items: T[]) => void): void;
  removeHandler(symbol: string): void;
  stop(): void;
}

export function createThrottledStream<T>(
  config: ThrottleConfig = defaultThrottleConfig
): ThrottledStream<T> {
  const throttles = new Map<string, Throttle<T>>();

  function getOrCreate(symbol: string): Throttle<T> {
    let throttle = throttles.get(symbol);
    if (!throttle) {
      throttle = createThrottle<T>(config);
      throttles.set(symbol, throttle);
    }
    return throttle;
  }

  return {
    push(symbol: string, item: T): void {
      getOrCreate(symbol).push(item);
    },

    setHandler(symbol: string, handler: (items: T[]) => void): void {
      getOrCreate(symbol).setHandler(handler);
    },

    removeHandler(symbol: string): void {
      const throttle = throttles.get(symbol);
      if (throttle) {
        throttle.stop();
        throttles.delete(symbol);
      }
    },

    stop(): void {
      for (const throttle of throttles.values()) {
        throttle.stop();
      }
      throttles.clear();
    },
  };
}

/**
 * Adaptive throttle - adjusts rate based on load
 */
export interface AdaptiveThrottleConfig {
  minIntervalMs: number;
  maxIntervalMs: number;
  targetQueueSize: number;
}

export function createAdaptiveThrottle<T>(
  config: AdaptiveThrottleConfig
): Throttle<T> {
  let currentInterval = config.minIntervalMs;
  const queue: T[] = [];
  let handler: ((items: T[]) => void) | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  function adjustInterval() {
    // Increase interval if queue is growing
    if (queue.length > config.targetQueueSize * 1.5) {
      currentInterval = Math.min(currentInterval * 1.5, config.maxIntervalMs);
    }
    // Decrease interval if queue is small
    else if (queue.length < config.targetQueueSize * 0.5) {
      currentInterval = Math.max(currentInterval * 0.75, config.minIntervalMs);
    }
  }

  function scheduleFlush() {
    if (timer) return;
    timer = setTimeout(() => {
      timer = null;
      if (queue.length > 0 && handler) {
        const items = [...queue];
        queue.length = 0;
        adjustInterval();
        handler(items);
      }
      if (handler) {
        scheduleFlush();
      }
    }, currentInterval);
  }

  return {
    push(item: T): void {
      queue.push(item);
    },

    flush(): T[] {
      const items = [...queue];
      queue.length = 0;
      return items;
    },

    setHandler(h: (items: T[]) => void): void {
      handler = h;
      scheduleFlush();
    },

    stop(): void {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      handler = null;
    },
  };
}
