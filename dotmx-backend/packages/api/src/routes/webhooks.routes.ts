/**
 * Webhooks Routes
 * 
 * Handles incoming webhooks from external services:
 * - Alchemy Address Activity webhooks for deposit detection
 */

import { Elysia, t } from 'elysia';
import type { DatabaseService } from '@dotmx/shared';
import { AlchemyWebhookService } from '@dotmx/shared';
import type { AlchemyWebhookPayload } from '@dotmx/shared';

// =============================================================================
// ROUTE FACTORY
// =============================================================================

export function createWebhooksRoutes(db: DatabaseService) {
  console.log('[Webhooks] Initializing webhook routes...');
  const alchemyService = new AlchemyWebhookService(db);

  return new Elysia({ prefix: '/webhooks' })
    .onStart(() => {
      console.log('[Webhooks] Routes registered at /webhooks/*');
    })
    // =========================================================================
    // ALCHEMY WEBHOOKS
    // =========================================================================
    
    /**
     * Alchemy Address Activity Webhook
     * Receives deposit notifications in real-time
     */
    .post('/alchemy/deposits', async ({ body, headers, request }) => {
      // Get raw body for signature verification
      const rawBody = JSON.stringify(body);
      const signature = headers['x-alchemy-signature'] as string;
      const payload = body as AlchemyWebhookPayload;

      // Store raw webhook payload to database FIRST (before any processing)
      let logId: string | null = null;
      try {
        const logResult = await db.queryOne<{ id: string }>(
          `INSERT INTO webhook_logs (source, webhook_id, event_type, network, payload, status)
           VALUES ('alchemy', $1, $2, $3, $4, 'received')
           RETURNING id`,
          [
            payload.webhookId || null,
            payload.type || null,
            payload.event?.network || null,
            JSON.stringify(body),
          ]
        );
        logId = logResult?.id || null;
        console.log(`[Webhook] Stored raw webhook payload: log_id=${logId}`);
      } catch (logError) {
        console.error('[Webhook] Failed to store webhook log:', logError);
        // Continue processing even if logging fails
      }

      // Verify signature
      if (!alchemyService.verifySignature(rawBody, signature)) {
        console.warn('[Webhook] Invalid Alchemy signature');
        // Update log status
        if (logId) {
          await db.execute(
            `UPDATE webhook_logs SET status = 'rejected', error_message = 'Invalid signature', processed_at = NOW() WHERE id = $1`,
            [logId]
          ).catch(() => {});
        }
        return {
          success: false,
          error: 'Invalid signature',
        };
      }

      try {
        const result = await alchemyService.processWebhookPayload(payload);

        // Update log with processing result
        if (logId) {
          await db.execute(
            `UPDATE webhook_logs SET status = 'processed', processing_result = $1, processed_at = NOW() WHERE id = $2`,
            [JSON.stringify(result), logId]
          ).catch(() => {});
        }

        return {
          success: true,
          ...result,
        };
      } catch (error) {
        console.error('[Webhook] Error processing Alchemy webhook:', error);
        // Update log with error
        if (logId) {
          await db.execute(
            `UPDATE webhook_logs SET status = 'error', error_message = $1, processed_at = NOW() WHERE id = $2`,
            [(error as Error).message, logId]
          ).catch(() => {});
        }
        return {
          success: false,
          error: 'Processing failed',
        };
      }
    }, {
      // Use permissive body validation - Alchemy sends many extra fields
      // that would cause strict t.Object validation to reject the payload
      body: t.Any(),
      detail: {
        tags: ['webhooks'],
        summary: 'Alchemy deposit webhook',
        description: 'Receives deposit notifications from Alchemy Address Activity webhooks',
      },
    })

    /**
     * Webhook health check
     * Used by Alchemy to verify endpoint is active
     */
    .get('/alchemy/health', () => {
      return {
        status: 'ok',
        service: 'alchemy-webhook',
        timestamp: new Date().toISOString(),
      };
    }, {
      detail: {
        tags: ['webhooks'],
        summary: 'Webhook health check',
      },
    })

    /**
     * Alchemy webhook endpoint health check (GET)
     * Alchemy sends GET requests to verify the endpoint is alive
     */
    .get('/alchemy/deposits', () => {
      return { status: 'ok', service: 'alchemy-webhook' };
    })

    // =========================================================================
    // ADMIN ENDPOINTS
    // =========================================================================

    /**
     * Sync all deposit addresses to Alchemy
     * Admin endpoint to ensure all addresses are registered
     */
    .post('/alchemy/sync-addresses', async () => {
      try {
        const result = await alchemyService.syncAllAddresses();
        return {
          success: true,
          ...result,
        };
      } catch (error) {
        console.error('[Webhook] Error syncing addresses:', error);
        return {
          success: false,
          error: 'Sync failed',
        };
      }
    }, {
      detail: {
        tags: ['webhooks'],
        summary: 'Sync deposit addresses to Alchemy',
        description: 'Registers all active deposit addresses with Alchemy webhooks',
      },
    })

    /**
     * List configured Alchemy webhooks
     */
    .get('/alchemy/webhooks', async () => {
      try {
        const webhooks = await alchemyService.listWebhooks();
        return {
          success: true,
          data: webhooks.map(w => ({
            id: w.id,
            network: w.network,
            isActive: w.is_active,
            addressCount: w.addresses?.length || 0,
          })),
        };
      } catch (error) {
        console.error('[Webhook] Error listing webhooks:', error);
        return {
          success: false,
          error: 'Failed to list webhooks',
        };
      }
    }, {
      detail: {
        tags: ['webhooks'],
        summary: 'List Alchemy webhooks',
      },
    })

    /**
     * Get webhook logs - view stored raw webhook payloads
     */
    .get('/logs', async ({ query }) => {
      try {
        const limit = Math.min(parseInt(query.limit || '50', 10), 200);
        const offset = parseInt(query.offset || '0', 10);
        const status = query.status || null;

        let sql = `SELECT id, source, webhook_id, event_type, network, payload, processing_result, status, error_message, created_at, processed_at
                    FROM webhook_logs`;
        const params: any[] = [];
        
        if (status) {
          sql += ` WHERE status = $1`;
          params.push(status);
        }
        
        sql += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(limit, offset);

        const logs = await db.query<any>(sql, params);
        
        const countSql = status 
          ? `SELECT count(*) as total FROM webhook_logs WHERE status = $1`
          : `SELECT count(*) as total FROM webhook_logs`;
        const countResult = await db.queryOne<{ total: string }>(
          countSql, 
          status ? [status] : []
        );

        return {
          success: true,
          data: logs,
          pagination: {
            limit,
            offset,
            total: parseInt(countResult?.total || '0', 10),
          },
        };
      } catch (error) {
        console.error('[Webhook] Error fetching webhook logs:', error);
        return {
          success: false,
          error: 'Failed to fetch logs',
        };
      }
    }, {
      query: t.Object({
        limit: t.Optional(t.String()),
        offset: t.Optional(t.String()),
        status: t.Optional(t.String()),
      }),
      detail: {
        tags: ['webhooks'],
        summary: 'Get webhook logs',
        description: 'View stored raw webhook payloads and processing results',
      },
    })

    /**
     * Reprocess a webhook log entry
     */
    .post('/logs/:id/reprocess', async ({ params }) => {
      try {
        const log = await db.queryOne<{ id: string; payload: any; status: string }>(
          `SELECT id, payload, status FROM webhook_logs WHERE id = $1`,
          [params.id]
        );

        if (!log) {
          return { success: false, error: 'Log entry not found' };
        }

        const payload = typeof log.payload === 'string' ? JSON.parse(log.payload) : log.payload;
        const result = await alchemyService.processWebhookPayload(payload as AlchemyWebhookPayload);

        await db.execute(
          `UPDATE webhook_logs SET status = 'reprocessed', processing_result = $1, processed_at = NOW() WHERE id = $2`,
          [JSON.stringify(result), log.id]
        );

        return {
          success: true,
          ...result,
        };
      } catch (error) {
        console.error('[Webhook] Error reprocessing webhook log:', error);
        return {
          success: false,
          error: 'Reprocessing failed',
        };
      }
    }, {
      detail: {
        tags: ['webhooks'],
        summary: 'Reprocess a webhook log entry',
      },
    });
}
