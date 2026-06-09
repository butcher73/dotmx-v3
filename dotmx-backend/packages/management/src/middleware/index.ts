// @ts-nocheck
/**
 * Management API Middleware
 * Authentication and logging
 */

import { Elysia } from 'elysia';

/**
 * Management API Key Authentication
 * 
 * Validates internal API key for service-to-service communication.
 */
export function managementApiKeyPlugin(apiKey: string) {
  return new Elysia({ name: 'managementApiKey' })
    .derive(({ request }) => {
      const providedKey = request.headers.get('x-management-api-key');
      
      return {
        isValidApiKey: providedKey === apiKey,
        hasApiKey: !!providedKey
      };
    })
    .macro(({ onBeforeHandle }) => ({
      requireApiKey(enabled: boolean) {
        if (!enabled) return;
        
        onBeforeHandle(({ isValidApiKey, set }: { isValidApiKey: boolean; set: any }) => {
          if (!isValidApiKey) {
            set.status = 401;
            return {
              error: 'Unauthorized',
              message: 'Invalid or missing API key'
            };
          }
        });
      }
    }));
}

/**
 * Request Logger for Management API
 */
export function managementLoggerPlugin() {
  const requestTimes = new Map<string, number>();
  
  return new Elysia({ name: 'managementLogger' })
    .onRequest(({ request }) => {
      const url = new URL(request.url);
      const reqId = `${request.method}-${url.pathname}-${Date.now()}-${Math.random()}`;
      requestTimes.set(reqId, Date.now());
      (request as any).__reqId = reqId;
      console.log(`[MGMT] → ${request.method} ${url.pathname}`);
    })
    .onAfterHandle(({ request, set }) => {
      const url = new URL(request.url);
      const reqId = (request as any).__reqId;
      const startTime = requestTimes.get(reqId) || Date.now();
      const duration = Date.now() - startTime;
      requestTimes.delete(reqId);
      console.log(`[MGMT] ← ${request.method} ${url.pathname} ${set.status || 200} (${duration}ms)`);
    })
    .onError(({ request, error, set }) => {
      const url = new URL(request.url);
      const reqId = (request as any).__reqId;
      const startTime = requestTimes.get(reqId) || Date.now();
      const duration = Date.now() - startTime;
      requestTimes.delete(reqId);
      console.error(`[MGMT] ✕ ${request.method} ${url.pathname} ${set.status || 500} (${duration}ms) - ${error.message}`);
    });
}

export * from './admin-auth.middleware';
