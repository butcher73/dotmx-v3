/**
 * KYC Management Routes
 */

import { Elysia, t } from 'elysia';
import type { DatabaseService } from '@dotmx/shared';
import type { KycApplication, PaginatedResponse } from '../types';

export function createKycRoutes(db: DatabaseService) {
  return new Elysia({ prefix: '/kyc' })
    .get(
      '/',
      async ({ query }) => {
        const page = query.page || 1;
        const pageSize = query.pageSize || 20;
        const offset = (page - 1) * pageSize;

        try {
          let whereClause = 'WHERE 1=1';
          const params: (string | number)[] = [];
          let paramIndex = 1;

          if (query.status) {
            whereClause += ` AND k.status = $${paramIndex}`;
            params.push(query.status);
            paramIndex++;
          }

          if (query.level) {
            whereClause += ` AND k.level = $${paramIndex}`;
            params.push(query.level);
            paramIndex++;
          }

          // Get total count
          const countResult = await db.queryOne<{ count: string }>(
            `SELECT COUNT(*) as count FROM kyc_applications k ${whereClause}`,
            params
          );
          const totalItems = parseInt(countResult?.count || '0', 10);

          // Get applications
          const applications = await db.query<{
            id: string;
            user_id: string;
            user_email: string;
            status: string;
            level: number;
            document_type: string;
            submitted_at: string;
            reviewed_at: string | null;
            reviewed_by: string | null;
            notes: string | null;
          }>(
            `SELECT
               k.id, k.user_id, u.email as user_email,
               k.status, k.level, k.document_type,
               k.submitted_at, k.reviewed_at, k.reviewed_by, k.notes
             FROM kyc_applications k
             JOIN users u ON k.user_id = u.id
             ${whereClause}
             ORDER BY k.submitted_at DESC
             LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
            [...params, pageSize, offset]
          );

          const response: PaginatedResponse<KycApplication> = {
            data: applications.map(k => ({
              id: k.id,
              userId: k.user_id,
              userEmail: k.user_email,
              status: k.status as KycApplication['status'],
              level: k.level as KycApplication['level'],
              documentType: k.document_type,
              submittedAt: k.submitted_at,
              reviewedAt: k.reviewed_at,
              reviewedBy: k.reviewed_by,
              notes: k.notes
            })),
            pagination: {
              page,
              pageSize,
              totalItems,
              totalPages: Math.ceil(totalItems / pageSize)
            }
          };

          return response;
        } catch (error) {
          console.error('[KYC] Failed to fetch applications:', error);
          return {
            data: [],
            pagination: { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 }
          };
        }
      },
      {
        query: t.Object({
          page: t.Optional(t.Number({ minimum: 1 })),
          pageSize: t.Optional(t.Number({ minimum: 1, maximum: 100 })),
          status: t.Optional(t.String()),
          level: t.Optional(t.Number())
        }),
        detail: {
          tags: ['kyc'],
          summary: 'List KYC applications',
          description: 'Get paginated list of KYC applications with filters'
        }
      }
    )
    .get(
      '/:applicationId',
      async ({ params }) => {
        try {
          const application = await db.queryOne<{
            id: string;
            user_id: string;
            user_email: string;
            status: string;
            level: number;
            document_type: string;
            document_number: string;
            document_country: string;
            document_expiry: string | null;
            first_name: string;
            last_name: string;
            date_of_birth: string;
            address: Record<string, unknown>;
            submitted_at: string;
            reviewed_at: string | null;
            reviewed_by: string | null;
            notes: string | null;
            documents: Record<string, unknown>[];
          }>(
            `SELECT
               k.*, u.email as user_email
             FROM kyc_applications k
             JOIN users u ON k.user_id = u.id
             WHERE k.id = $1`,
            [params.applicationId]
          );

          if (!application) {
            return { error: 'Application not found' };
          }

          return application;
        } catch (error) {
          console.error('[KYC] Failed to fetch application:', error);
          return { error: 'Failed to fetch application' };
        }
      },
      {
        params: t.Object({
          applicationId: t.String()
        }),
        detail: {
          tags: ['kyc'],
          summary: 'Get KYC application details',
          description: 'Get detailed information about a KYC application'
        }
      }
    )
    .patch(
      '/:applicationId/review',
      async ({ params, body, headers }) => {
        // Note: adminUser would be available from admin auth middleware when composed
        const adminUserId = headers['x-admin-user-id'] || null;

        try {
          await db.query(
            `UPDATE kyc_applications
             SET status = $1, notes = $2, reviewed_by = $3, reviewed_at = NOW(),
                 approved_at = CASE WHEN $1 = 'approved' THEN NOW() ELSE approved_at END,
                 rejected_at = CASE WHEN $1 = 'rejected' THEN NOW() ELSE rejected_at END
             WHERE id = $4`,
            [body.status, body.notes || null, adminUserId, params.applicationId]
          );

          // Update user KYC status if approved
          if (body.status === 'approved') {
            const app = await db.queryOne<{ user_id: string; level: number }>(
              `SELECT user_id, level FROM kyc_applications WHERE id = $1`,
              [params.applicationId]
            );

            if (app) {
              // Update dedicated KYC columns (the canonical source)
              await db.query(
                `UPDATE users SET kyc_status = 'approved', kyc_level = $1, updated_at = NOW() WHERE id = $2`,
                [app.level, app.user_id]
              );
              // Also maintain backward compatibility in metadata
              await db.query(
                `UPDATE users SET metadata = jsonb_set(COALESCE(metadata, '{}'), '{kyc_level}', $1::jsonb) WHERE id = $2`,
                [JSON.stringify(app.level), app.user_id]
              );
            }
          }

          // Update user KYC status if rejected
          if (body.status === 'rejected') {
            const app = await db.queryOne<{ user_id: string }>(
              `SELECT user_id FROM kyc_applications WHERE id = $1`,
              [params.applicationId]
            );
            if (app) {
              await db.query(
                `UPDATE users SET kyc_status = 'rejected', updated_at = NOW() WHERE id = $1`,
                [app.user_id]
              );
            }
          }

          return { success: true };
        } catch (error) {
          console.error('[KYC] Failed to review application:', error);
          return { error: 'Failed to update application' };
        }
      },
      {
        params: t.Object({
          applicationId: t.String()
        }),
        body: t.Object({
          status: t.Union([
            t.Literal('approved'),
            t.Literal('rejected'),
            t.Literal('in_review')
          ]),
          notes: t.Optional(t.String())
        }),
        detail: {
          tags: ['kyc'],
          summary: 'Review KYC application',
          description: 'Approve or reject a KYC application'
        }
      }
    );
}
