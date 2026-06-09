/**
 * Settings Management Routes
 */

import { Elysia, t } from 'elysia';
import type { DatabaseService } from '@dotmx/shared';

interface Setting {
  key: string;
  value: unknown;
  category: string;
  description: string;
  updatedAt: string;
  updatedBy: string | null;
}

export function createSettingsRoutes(db: DatabaseService) {
  return new Elysia({ prefix: '/settings' })
    .get(
      '/',
      async ({ query }) => {
        try {
          let whereClause = 'WHERE 1=1';
          const params: string[] = [];
          let paramIndex = 1;
          
          if (query.category) {
            whereClause += ` AND category = $${paramIndex}`;
            params.push(query.category);
            paramIndex++;
          }
          
          const settings = await db.query<{
            key: string;
            value: unknown;
            category: string;
            description: string;
            updated_at: string;
            updated_by: string | null;
          }>(
            `SELECT key, value, category, description, updated_at, updated_by
             FROM settings
             ${whereClause}
             ORDER BY category, key`,
            params
          );
          
          return settings.map(s => ({
            key: s.key,
            value: s.value,
            category: s.category,
            description: s.description,
            updatedAt: s.updated_at,
            updatedBy: s.updated_by
          }));
        } catch (error) {
          console.error('[Settings] Failed to fetch:', error);
          // Return default settings
          return getDefaultSettings();
        }
      },
      {
        query: t.Object({
          category: t.Optional(t.String())
        }),
        detail: {
          tags: ['settings'],
          summary: 'Get all settings',
          description: 'Get platform configuration settings'
        }
      }
    )
    .get(
      '/categories',
      async () => {
        try {
          const categories = await db.query<{ category: string }>(
            `SELECT DISTINCT category FROM settings ORDER BY category`
          );
          return categories.map(c => c.category);
        } catch (error) {
          return ['general', 'trading', 'security', 'fees', 'notifications', 'integrations'];
        }
      },
      {
        detail: {
          tags: ['settings'],
          summary: 'Get setting categories',
          description: 'Get list of available setting categories'
        }
      }
    )
    .get(
      '/:key',
      async ({ params }) => {
        try {
          const setting = await db.queryOne<{
            key: string;
            value: unknown;
            category: string;
            description: string;
            updated_at: string;
            updated_by: string | null;
          }>(
            `SELECT key, value, category, description, updated_at, updated_by
             FROM settings WHERE key = $1`,
            [params.key]
          );
          
          if (!setting) {
            return { error: 'Setting not found' };
          }
          
          return {
            key: setting.key,
            value: setting.value,
            category: setting.category,
            description: setting.description,
            updatedAt: setting.updated_at,
            updatedBy: setting.updated_by
          };
        } catch (error) {
          console.error('[Settings] Failed to fetch:', error);
          return { error: 'Failed to fetch setting' };
        }
      },
      {
        params: t.Object({
          key: t.String()
        }),
        detail: {
          tags: ['settings'],
          summary: 'Get setting by key',
          description: 'Get a specific setting value'
        }
      }
    )
    .put(
      '/:key',
      async ({ params, body, headers }) => {
        // Note: adminUser would be available from admin auth middleware when composed
        const adminUserId = headers['x-admin-user-id'] || null;
        
        try {
          await db.query(
            `INSERT INTO settings (key, value, category, description, updated_by, updated_at)
             VALUES ($1, $2, $3, $4, $5, NOW())
             ON CONFLICT (key) DO UPDATE SET
               value = EXCLUDED.value,
               category = COALESCE(EXCLUDED.category, settings.category),
               description = COALESCE(EXCLUDED.description, settings.description),
               updated_by = EXCLUDED.updated_by,
               updated_at = NOW()`,
            [
              params.key,
              JSON.stringify(body.value),
              body.category || 'general',
              body.description || '',
              adminUserId
            ]
          );
          
          return { success: true };
        } catch (error) {
          console.error('[Settings] Failed to update:', error);
          return { error: 'Failed to update setting' };
        }
      },
      {
        params: t.Object({
          key: t.String()
        }),
        body: t.Object({
          value: t.Unknown(),
          category: t.Optional(t.String()),
          description: t.Optional(t.String())
        }),
        detail: {
          tags: ['settings'],
          summary: 'Update setting',
          description: 'Create or update a platform setting'
        }
      }
    )
    .delete(
      '/:key',
      async ({ params }) => {
        try {
          await db.query(
            `DELETE FROM settings WHERE key = $1`,
            [params.key]
          );
          
          return { success: true };
        } catch (error) {
          console.error('[Settings] Failed to delete:', error);
          return { error: 'Failed to delete setting' };
        }
      },
      {
        params: t.Object({
          key: t.String()
        }),
        detail: {
          tags: ['settings'],
          summary: 'Delete setting',
          description: 'Remove a platform setting'
        }
      }
    );
}

function getDefaultSettings(): Setting[] {
  return [
    {
      key: 'platform.name',
      value: 'DotMX',
      category: 'general',
      description: 'Platform display name',
      updatedAt: new Date().toISOString(),
      updatedBy: null
    },
    {
      key: 'platform.maintenance_mode',
      value: false,
      category: 'general',
      description: 'Enable maintenance mode',
      updatedAt: new Date().toISOString(),
      updatedBy: null
    },
    {
      key: 'trading.min_order_value',
      value: 10,
      category: 'trading',
      description: 'Minimum order value in USD',
      updatedAt: new Date().toISOString(),
      updatedBy: null
    },
    {
      key: 'fees.default_maker',
      value: 0.001,
      category: 'fees',
      description: 'Default maker fee (0.1%)',
      updatedAt: new Date().toISOString(),
      updatedBy: null
    },
    {
      key: 'fees.default_taker',
      value: 0.002,
      category: 'fees',
      description: 'Default taker fee (0.2%)',
      updatedAt: new Date().toISOString(),
      updatedBy: null
    },
    {
      key: 'security.require_2fa',
      value: false,
      category: 'security',
      description: 'Require 2FA for all users',
      updatedAt: new Date().toISOString(),
      updatedBy: null
    }
  ];
}
