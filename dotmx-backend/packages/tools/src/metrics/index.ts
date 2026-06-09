/**
 * Metrics Collection
 *
 * Performance monitoring and metrics export.
 */

export interface Metric {
  name: string;
  value: number;
  labels: Record<string, string>;
  timestamp: number;
}

export interface Counter {
  inc(labels?: Record<string, string>): void;
  add(value: number, labels?: Record<string, string>): void;
  get(labels?: Record<string, string>): number;
}

export interface Gauge {
  set(value: number, labels?: Record<string, string>): void;
  inc(labels?: Record<string, string>): void;
  dec(labels?: Record<string, string>): void;
  get(labels?: Record<string, string>): number;
}

export interface Histogram {
  observe(value: number, labels?: Record<string, string>): void;
  getPercentile(p: number, labels?: Record<string, string>): number;
  getCount(labels?: Record<string, string>): number;
  getSum(labels?: Record<string, string>): number;
}

export interface MetricsRegistry {
  counter(name: string, help: string): Counter;
  gauge(name: string, help: string): Gauge;
  histogram(name: string, help: string, buckets?: number[]): Histogram;
  getMetrics(): Metric[];
  exportPrometheus(): string;
  reset(): void;
}

function labelsToKey(labels?: Record<string, string>): string {
  if (!labels) return "";
  return Object.entries(labels)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}="${v}"`)
    .join(",");
}

/**
 * Create metrics registry
 */
export function createMetricsRegistry(): MetricsRegistry {
  const counters = new Map<string, { help: string; values: Map<string, number> }>();
  const gauges = new Map<string, { help: string; values: Map<string, number> }>();
  const histograms = new Map<string, {
    help: string;
    buckets: number[];
    observations: Map<string, number[]>;
  }>();

  return {
    counter(name: string, help: string): Counter {
      if (!counters.has(name)) {
        counters.set(name, { help, values: new Map() });
      }
      const counter = counters.get(name)!;

      return {
        inc(labels?: Record<string, string>): void {
          this.add(1, labels);
        },
        add(value: number, labels?: Record<string, string>): void {
          const key = labelsToKey(labels);
          counter.values.set(key, (counter.values.get(key) ?? 0) + value);
        },
        get(labels?: Record<string, string>): number {
          return counter.values.get(labelsToKey(labels)) ?? 0;
        },
      };
    },

    gauge(name: string, help: string): Gauge {
      if (!gauges.has(name)) {
        gauges.set(name, { help, values: new Map() });
      }
      const gauge = gauges.get(name)!;

      return {
        set(value: number, labels?: Record<string, string>): void {
          gauge.values.set(labelsToKey(labels), value);
        },
        inc(labels?: Record<string, string>): void {
          const key = labelsToKey(labels);
          gauge.values.set(key, (gauge.values.get(key) ?? 0) + 1);
        },
        dec(labels?: Record<string, string>): void {
          const key = labelsToKey(labels);
          gauge.values.set(key, (gauge.values.get(key) ?? 0) - 1);
        },
        get(labels?: Record<string, string>): number {
          return gauge.values.get(labelsToKey(labels)) ?? 0;
        },
      };
    },

    histogram(name: string, help: string, buckets: number[] = [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5]): Histogram {
      if (!histograms.has(name)) {
        histograms.set(name, { help, buckets, observations: new Map() });
      }
      const hist = histograms.get(name)!;

      return {
        observe(value: number, labels?: Record<string, string>): void {
          const key = labelsToKey(labels);
          const obs = hist.observations.get(key) ?? [];
          obs.push(value);
          hist.observations.set(key, obs);
        },
        getPercentile(p: number, labels?: Record<string, string>): number {
          const obs = hist.observations.get(labelsToKey(labels)) ?? [];
          if (obs.length === 0) return 0;
          const sorted = [...obs].sort((a, b) => a - b);
          const idx = Math.floor(sorted.length * p);
          return sorted[idx] ?? 0;
        },
        getCount(labels?: Record<string, string>): number {
          return (hist.observations.get(labelsToKey(labels)) ?? []).length;
        },
        getSum(labels?: Record<string, string>): number {
          return (hist.observations.get(labelsToKey(labels)) ?? []).reduce((a, b) => a + b, 0);
        },
      };
    },

    getMetrics(): Metric[] {
      const result: Metric[] = [];
      const now = Date.now();

      for (const [name, { values }] of counters) {
        for (const [labelKey, value] of values) {
          result.push({
            name,
            value,
            labels: labelKey ? Object.fromEntries(labelKey.split(",").map((s) => s.split("="))) : {},
            timestamp: now,
          });
        }
      }

      for (const [name, { values }] of gauges) {
        for (const [labelKey, value] of values) {
          result.push({
            name,
            value,
            labels: labelKey ? Object.fromEntries(labelKey.split(",").map((s) => s.split("="))) : {},
            timestamp: now,
          });
        }
      }

      return result;
    },

    exportPrometheus(): string {
      const lines: string[] = [];

      for (const [name, { help, values }] of counters) {
        lines.push(`# HELP ${name} ${help}`);
        lines.push(`# TYPE ${name} counter`);
        for (const [labelKey, value] of values) {
          const labelStr = labelKey ? `{${labelKey}}` : "";
          lines.push(`${name}${labelStr} ${value}`);
        }
      }

      for (const [name, { help, values }] of gauges) {
        lines.push(`# HELP ${name} ${help}`);
        lines.push(`# TYPE ${name} gauge`);
        for (const [labelKey, value] of values) {
          const labelStr = labelKey ? `{${labelKey}}` : "";
          lines.push(`${name}${labelStr} ${value}`);
        }
      }

      for (const [name, { help, buckets, observations }] of histograms) {
        lines.push(`# HELP ${name} ${help}`);
        lines.push(`# TYPE ${name} histogram`);
        for (const [labelKey, obs] of observations) {
          const sorted = [...obs].sort((a, b) => a - b);
          const labelStr = labelKey ? `{${labelKey}}` : "";

          for (const bucket of buckets) {
            const count = sorted.filter((v) => v <= bucket).length;
            lines.push(`${name}_bucket{le="${bucket}"${labelKey ? "," + labelKey : ""}} ${count}`);
          }
          lines.push(`${name}_bucket{le="+Inf"${labelKey ? "," + labelKey : ""}} ${obs.length}`);
          lines.push(`${name}_sum${labelStr} ${obs.reduce((a, b) => a + b, 0)}`);
          lines.push(`${name}_count${labelStr} ${obs.length}`);
        }
      }

      return lines.join("\n");
    },

    reset(): void {
      counters.clear();
      gauges.clear();
      histograms.clear();
    },
  };
}

/**
 * Pre-built metrics for matching engine
 */
export interface EngineMetrics {
  ordersReceived: Counter;
  ordersMatched: Counter;
  ordersCanceled: Counter;
  tradesExecuted: Counter;
  matchLatency: Histogram;
  orderbookDepth: Gauge;
  activeConnections: Gauge;
}

export function createEngineMetrics(registry: MetricsRegistry): EngineMetrics {
  return {
    ordersReceived: registry.counter("engine_orders_received_total", "Total orders received"),
    ordersMatched: registry.counter("engine_orders_matched_total", "Total orders matched"),
    ordersCanceled: registry.counter("engine_orders_canceled_total", "Total orders canceled"),
    tradesExecuted: registry.counter("engine_trades_executed_total", "Total trades executed"),
    matchLatency: registry.histogram("engine_match_latency_seconds", "Order matching latency", [
      0.00001, 0.00005, 0.0001, 0.0005, 0.001, 0.005, 0.01,
    ]),
    orderbookDepth: registry.gauge("engine_orderbook_depth", "Orderbook depth by side"),
    activeConnections: registry.gauge("engine_active_connections", "Active WebSocket connections"),
  };
}
