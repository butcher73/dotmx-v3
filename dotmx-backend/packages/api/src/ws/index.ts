/**
 * WebSocket Handlers
 *
 * Real-time streaming for market data and user updates.
 */

import { Elysia, t } from "elysia";
import type { GatewayAdapter } from "@dotmx/gateway";
import type { MarketDataFanout, MarketDataMessage } from "@dotmx/marketdata";

interface WebSocketContext {
  id: string;
  userId?: string;
  subscriptions: Set<string>;
}

/**
 * Create WebSocket handler for market data
 */
export function createMarketDataWs(fanout: MarketDataFanout) {
  const connections = new Map<string, WebSocketContext>();
  const connectionsBySymbol = new Map<string, Set<string>>();
  // Store actual WS references for sending data
  const wsRefs = new Map<string, any>();

  return new Elysia()
    .ws("/ws/market", {
      open(ws) {
        const ctx: WebSocketContext = {
          id: ws.id,
          subscriptions: new Set(),
        };
        connections.set(ws.id, ctx);
        wsRefs.set(ws.id, ws);
      },

      close(ws) {
        const ctx = connections.get(ws.id);
        if (ctx) {
          // Cleanup subscriptions
          for (const symbol of ctx.subscriptions) {
            const conns = connectionsBySymbol.get(symbol);
            if (conns) {
              conns.delete(ws.id);
            }
          }
          connections.delete(ws.id);
          wsRefs.delete(ws.id);
        }
      },

      message(ws, message) {
        const ctx = connections.get(ws.id);
        if (!ctx) return;

        const msg = message as {
          action: string;
          symbol?: string;
          symbols?: string[];
        };

        switch (msg.action) {
          case "subscribe": {
            const symbols = msg.symbols ?? (msg.symbol ? [msg.symbol] : []);
            for (const symbol of symbols) {
              ctx.subscriptions.add(symbol);

              let conns = connectionsBySymbol.get(symbol);
              if (!conns) {
                conns = new Set();
                connectionsBySymbol.set(symbol, conns);

                // Subscribe to fanout for this symbol
                fanout.subscribe(symbol, (data: MarketDataMessage) => {
                  const symbolConns = connectionsBySymbol.get(symbol);
                  if (symbolConns) {
                    const payload = JSON.stringify({
                      stream: `${symbol}@${data.type}`,
                      data: data.data,
                    });
                    for (const connId of symbolConns) {
                      const wsRef = wsRefs.get(connId);
                      if (wsRef) {
                        try {
                          wsRef.send(payload);
                        } catch {
                          // Client disconnected, will be cleaned up on close
                        }
                      }
                    }
                  }
                });
              }
              conns.add(ws.id);
            }

            ws.send(
              JSON.stringify({
                type: "subscribed",
                symbols,
              })
            );
            break;
          }

          case "unsubscribe": {
            const symbols = msg.symbols ?? (msg.symbol ? [msg.symbol] : []);
            for (const symbol of symbols) {
              ctx.subscriptions.delete(symbol);
              const conns = connectionsBySymbol.get(symbol);
              if (conns) {
                conns.delete(ws.id);
              }
            }

            ws.send(
              JSON.stringify({
                type: "unsubscribed",
                symbols,
              })
            );
            break;
          }
        }
      },
    });
}

/**
 * Create WebSocket handler for user-specific updates (orders, fills)
 */
export function createUserWs(gateway: GatewayAdapter) {
  const userConnections = new Map<string, Set<any>>();

  return new Elysia()
    .ws("/ws/user", {
      body: t.Object({
        action: t.String(),
        userId: t.Optional(t.String()),
      }),

      open(ws) {
        // Wait for auth message
      },

      close(ws) {
        // Cleanup
        for (const [userId, conns] of userConnections) {
          conns.delete(ws);
          if (conns.size === 0) {
            userConnections.delete(userId);
          }
        }
      },

      message(ws, message) {
        const msg = message as { action: string; userId?: string };

        switch (msg.action) {
          case "auth": {
            if (!msg.userId) {
              ws.send(JSON.stringify({ type: "error", message: "userId required" }));
              return;
            }

            let conns = userConnections.get(msg.userId);
            if (!conns) {
              conns = new Set();
              userConnections.set(msg.userId, conns);

              // Subscribe to fills for this user
              gateway.subscribeToFills(msg.userId, (fill) => {
                const userConns = userConnections.get(msg.userId!);
                if (userConns) {
                  for (const conn of userConns) {
                    conn.send(JSON.stringify({ type: "fill", data: fill }));
                  }
                }
              });
            }
            conns.add(ws);

            ws.send(JSON.stringify({ type: "authenticated", userId: msg.userId }));
            break;
          }
        }
      },
    });
}

/**
 * Create combined WebSocket app
 */
export function createWsApp(gateway: GatewayAdapter, fanout: MarketDataFanout) {
  return new Elysia()
    .use(createMarketDataWs(fanout))
    .use(createUserWs(gateway));
}
