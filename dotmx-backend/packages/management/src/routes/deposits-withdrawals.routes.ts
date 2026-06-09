/**
 * Deposits & Withdrawals Management Routes
 * 
 * Proper architecture using dedicated tables:
 * - deposits: Track incoming on-chain deposits
 * - withdrawal_requests: Track withdrawal lifecycle
 * - sweep_operations: Track sweeping to hot/warm wallets
 * - sweeper_status: Track sweeper service status
 * 
 * Uses database views for efficient querying with joins
 */

import { Elysia, t } from 'elysia';
import type { DatabaseService } from '@dotmx/shared';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

export interface Deposit {
  id: string;
  userId: string;
  userEmail: string;
  chainCode: string;
  tokenSymbol: string;
  amount: string;
  txHash: string;
  fromAddress: string;
  toAddress: string;
  status: 'pending' | 'confirming' | 'confirmed' | 'swept' | 'failed';
  confirmations: number;
  requiredConfirmations: number;
  detectedAt: string;
  confirmedAt: string | null;
  creditedAt: string | null;
  sweptAt: string | null;
  sweepOperationId: string | null;
  blockNumber: number | null;
}

export interface Withdrawal {
  id: string;
  userId: string;
  userEmail: string;
  chainCode: string;
  tokenSymbol: string;
  amount: string;
  feeAmount: string;
  netAmount: string;
  destinationAddress: string;
  status: 'pending_approval' | 'approved' | 'processing' | 'broadcasted' | 'confirming' | 'completed' | 'failed' | 'cancelled' | 'rejected';
  txHash: string | null;
  confirmations: number;
  approvedAt: string | null;
  broadcastedAt: string | null;
  completedAt: string | null;
  failedAt: string | null;
  failureReason: string | null;
  createdAt: string;
}

export interface SweepOperation {
  id: string;
  chainCode: string;
  tokenSymbol: string;
  fromAddress: string;
  toAddress: string;
  amount: string;
  txHash: string | null;
  gasTxHash: string | null;
  gasUsed: string | null;
  totalGasCost: string | null;
  status: 'pending' | 'gas_sent' | 'broadcasting' | 'confirming' | 'completed' | 'failed';
  scheduledAt: string;
  completedAt: string | null;
  failedAt: string | null;
  failureReason: string | null;
  retryCount: number;
  blockNumber: number | null;
}

export interface DepositsWithdrawalsStats {
  totalDepositsToday: number;
  totalDepositsValueToday: string;
  totalWithdrawalsToday: number;
  totalWithdrawalsValueToday: string;
  pendingDeposits: number;
  pendingWithdrawals: number;
  pendingApprovals: number;
  pendingSweeps: number;
  netFlowToday: string;
}

export interface SweeperStatus {
  isRunning: boolean;
  lastRunAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
  lastErrorAt: string | null;
  totalSwept24h: string;
  operationsCompleted24h: number;
  operationsFailed24h: number;
}

// =============================================================================
// ROUTES
// =============================================================================

export function createDepositsWithdrawalsRoutes(db: DatabaseService) {
  return new Elysia({ prefix: '/deposits-withdrawals' })
    
    // =========================================================================
    // STATISTICS
    // =========================================================================
    .get('/stats', async () => {
      try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayIso = today.toISOString();

        // Parallel queries for efficiency
        const [
          depositsToday,
          withdrawalsToday,
          pendingDeposits,
          pendingApprovals,
          pendingWithdrawals,
          pendingSweeps,
        ] = await Promise.all([
          // Deposits today
          db.queryOne<{ count: string; total: string }>(
            `SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as total
             FROM deposits WHERE detected_at >= $1`,
            [todayIso]
          ),
          // Withdrawals today
          db.queryOne<{ count: string; total: string }>(
            `SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as total
             FROM withdrawal_requests WHERE created_at >= $1`,
            [todayIso]
          ),
          // Pending deposits
          db.queryOne<{ count: string }>(
            `SELECT COUNT(*) as count FROM deposits WHERE status IN ('pending', 'confirming')`
          ),
          // Pending approvals
          db.queryOne<{ count: string }>(
            `SELECT COUNT(*) as count FROM withdrawal_requests WHERE status = 'pending_approval'`
          ),
          // All pending withdrawals
          db.queryOne<{ count: string }>(
            `SELECT COUNT(*) as count FROM withdrawal_requests 
             WHERE status IN ('pending_approval', 'approved', 'processing', 'broadcasted', 'confirming')`
          ),
          // Pending sweeps
          db.queryOne<{ count: string }>(
            `SELECT COUNT(*) as count FROM sweep_operations WHERE status IN ('pending', 'gas_sent', 'broadcasting')`
          ),
        ]);

        const depositsValue = parseFloat(depositsToday?.total || '0');
        const withdrawalsValue = parseFloat(withdrawalsToday?.total || '0');

        return {
          totalDepositsToday: parseInt(depositsToday?.count || '0', 10),
          totalDepositsValueToday: depositsValue.toFixed(8),
          totalWithdrawalsToday: parseInt(withdrawalsToday?.count || '0', 10),
          totalWithdrawalsValueToday: withdrawalsValue.toFixed(8),
          pendingDeposits: parseInt(pendingDeposits?.count || '0', 10),
          pendingWithdrawals: parseInt(pendingWithdrawals?.count || '0', 10),
          pendingApprovals: parseInt(pendingApprovals?.count || '0', 10),
          pendingSweeps: parseInt(pendingSweeps?.count || '0', 10),
          netFlowToday: (depositsValue - withdrawalsValue).toFixed(8),
        };
      } catch (error) {
        console.error('[DepositsWithdrawals] Stats error:', error);
        return {
          totalDepositsToday: 0,
          totalDepositsValueToday: '0',
          totalWithdrawalsToday: 0,
          totalWithdrawalsValueToday: '0',
          pendingDeposits: 0,
          pendingWithdrawals: 0,
          pendingApprovals: 0,
          pendingSweeps: 0,
          netFlowToday: '0',
        };
      }
    }, {
      detail: {
        tags: ['deposits-withdrawals'],
        summary: 'Get deposits & withdrawals statistics',
      }
    })

    // =========================================================================
    // DEPOSITS
    // =========================================================================
    .get('/deposits', async ({ query }) => {
      const page = query.page || 1;
      const pageSize = query.pageSize || 20;
      const offset = (page - 1) * pageSize;

      try {
        let whereClause = 'WHERE 1=1';
        const params: (string | number)[] = [];
        let paramIndex = 1;

        if (query.status) {
          whereClause += ` AND status = $${paramIndex}`;
          params.push(query.status);
          paramIndex++;
        }

        if (query.chainCode) {
          whereClause += ` AND chain_code = $${paramIndex}`;
          params.push(query.chainCode);
          paramIndex++;
        }

        if (query.userId) {
          whereClause += ` AND user_id = $${paramIndex}`;
          params.push(query.userId);
          paramIndex++;
        }

        if (query.tokenSymbol) {
          whereClause += ` AND token_symbol = $${paramIndex}`;
          params.push(query.tokenSymbol);
          paramIndex++;
        }

        // Get count
        const countResult = await db.queryOne<{ count: string }>(
          `SELECT COUNT(*) as count FROM v_deposits ${whereClause}`,
          params
        );
        const totalItems = parseInt(countResult?.count || '0', 10);

        // Get deposits using the view
        const deposits = await db.query<{
          id: string;
          user_id: string;
          user_email: string;
          chain_code: string;
          token_symbol: string;
          amount: string;
          tx_hash: string;
          from_address: string;
          to_address: string;
          status: string;
          confirmations: number;
          required_confirmations: number;
          detected_at: string;
          confirmed_at: string | null;
          credited_at: string | null;
          swept_at: string | null;
          sweep_operation_id: string | null;
          block_number: number | null;
        }>(
          `SELECT * FROM v_deposits ${whereClause}
           ORDER BY detected_at DESC
           LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
          [...params, pageSize, offset]
        );

        return {
          data: deposits.map(d => ({
            id: d.id,
            userId: d.user_id,
            userEmail: d.user_email,
            chainCode: d.chain_code,
            tokenSymbol: d.token_symbol,
            amount: d.amount,
            txHash: d.tx_hash,
            fromAddress: d.from_address,
            toAddress: d.to_address,
            status: d.status,
            confirmations: d.confirmations,
            requiredConfirmations: d.required_confirmations,
            detectedAt: d.detected_at,
            confirmedAt: d.confirmed_at,
            creditedAt: d.credited_at,
            sweptAt: d.swept_at,
            sweepOperationId: d.sweep_operation_id,
            blockNumber: d.block_number,
          })),
          pagination: {
            page,
            pageSize,
            totalItems,
            totalPages: Math.ceil(totalItems / pageSize),
          },
        };
      } catch (error) {
        console.error('[DepositsWithdrawals] Deposits list error:', error);
        return {
          data: [],
          pagination: { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 },
        };
      }
    }, {
      query: t.Object({
        page: t.Optional(t.Number({ minimum: 1 })),
        pageSize: t.Optional(t.Number({ minimum: 1, maximum: 100 })),
        status: t.Optional(t.String()),
        chainCode: t.Optional(t.String()),
        userId: t.Optional(t.String()),
        tokenSymbol: t.Optional(t.String()),
      }),
      detail: {
        tags: ['deposits-withdrawals'],
        summary: 'List deposits',
        description: 'Get paginated list of deposits with filters',
      }
    })

    .get('/deposits/:id', async ({ params, set }) => {
      try {
        const deposit = await db.queryOne<{
          id: string;
          user_id: string;
          user_email: string;
          chain_code: string;
          chain_name: string;
          token_symbol: string;
          token_name: string;
          amount: string;
          tx_hash: string;
          from_address: string;
          to_address: string;
          status: string;
          confirmations: number;
          required_confirmations: number;
          detected_at: string;
          confirmed_at: string | null;
          credited_at: string | null;
          swept_at: string | null;
          sweep_operation_id: string | null;
          block_number: number | null;
        }>(
          `SELECT * FROM v_deposits WHERE id = $1`,
          [params.id]
        );

        if (!deposit) {
          set.status = 404;
          return { error: 'Deposit not found' };
        }

        return {
          id: deposit.id,
          userId: deposit.user_id,
          userEmail: deposit.user_email,
          chainCode: deposit.chain_code,
          chainName: deposit.chain_name,
          tokenSymbol: deposit.token_symbol,
          tokenName: deposit.token_name,
          amount: deposit.amount,
          txHash: deposit.tx_hash,
          fromAddress: deposit.from_address,
          toAddress: deposit.to_address,
          status: deposit.status,
          confirmations: deposit.confirmations,
          requiredConfirmations: deposit.required_confirmations,
          detectedAt: deposit.detected_at,
          confirmedAt: deposit.confirmed_at,
          creditedAt: deposit.credited_at,
          sweptAt: deposit.swept_at,
          sweepOperationId: deposit.sweep_operation_id,
          blockNumber: deposit.block_number,
        };
      } catch (error) {
        console.error('[DepositsWithdrawals] Deposit detail error:', error);
        set.status = 500;
        return { error: 'Failed to fetch deposit' };
      }
    }, {
      params: t.Object({ id: t.String() }),
      detail: {
        tags: ['deposits-withdrawals'],
        summary: 'Get deposit details',
      }
    })

    // =========================================================================
    // WITHDRAWALS
    // =========================================================================
    .get('/withdrawals', async ({ query }) => {
      const page = query.page || 1;
      const pageSize = query.pageSize || 20;
      const offset = (page - 1) * pageSize;

      try {
        let whereClause = 'WHERE 1=1';
        const params: (string | number)[] = [];
        let paramIndex = 1;

        if (query.status) {
          whereClause += ` AND status = $${paramIndex}`;
          params.push(query.status);
          paramIndex++;
        }

        if (query.chainCode) {
          whereClause += ` AND chain_code = $${paramIndex}`;
          params.push(query.chainCode);
          paramIndex++;
        }

        if (query.userId) {
          whereClause += ` AND user_id = $${paramIndex}`;
          params.push(query.userId);
          paramIndex++;
        }

        if (query.tokenSymbol) {
          whereClause += ` AND token_symbol = $${paramIndex}`;
          params.push(query.tokenSymbol);
          paramIndex++;
        }

        // Get count
        const countResult = await db.queryOne<{ count: string }>(
          `SELECT COUNT(*) as count FROM v_withdrawals ${whereClause}`,
          params
        );
        const totalItems = parseInt(countResult?.count || '0', 10);

        // Get withdrawals using the view
        const withdrawals = await db.query<{
          id: string;
          user_id: string;
          user_email: string;
          chain_code: string;
          token_symbol: string;
          amount: string;
          fee: string;
          net_amount: string;
          to_address: string;
          status: string;
          tx_hash: string | null;
          confirmations: number;
          approved_at: string | null;
          broadcasted_at: string | null;
          completed_at: string | null;
          failure_reason: string | null;
          created_at: string;
        }>(
          `SELECT * FROM v_withdrawals ${whereClause}
           ORDER BY created_at DESC
           LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
          [...params, pageSize, offset]
        );

        return {
          data: withdrawals.map(w => ({
            id: w.id,
            userId: w.user_id,
            userEmail: w.user_email,
            chainCode: w.chain_code,
            tokenSymbol: w.token_symbol,
            amount: w.amount,
            feeAmount: w.fee,
            netAmount: w.net_amount,
            destinationAddress: w.to_address,
            status: w.status,
            txHash: w.tx_hash,
            confirmations: w.confirmations,
            approvedAt: w.approved_at,
            broadcastedAt: w.broadcasted_at,
            completedAt: w.completed_at,
            failureReason: w.failure_reason,
            createdAt: w.created_at,
          })),
          pagination: {
            page,
            pageSize,
            totalItems,
            totalPages: Math.ceil(totalItems / pageSize),
          },
        };
      } catch (error) {
        console.error('[DepositsWithdrawals] Withdrawals list error:', error);
        return {
          data: [],
          pagination: { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 },
        };
      }
    }, {
      query: t.Object({
        page: t.Optional(t.Number({ minimum: 1 })),
        pageSize: t.Optional(t.Number({ minimum: 1, maximum: 100 })),
        status: t.Optional(t.String()),
        chainCode: t.Optional(t.String()),
        userId: t.Optional(t.String()),
        tokenSymbol: t.Optional(t.String()),
      }),
      detail: {
        tags: ['deposits-withdrawals'],
        summary: 'List withdrawals',
      }
    })

    .get('/withdrawals/:id', async ({ params, set }) => {
      try {
        const withdrawal = await db.queryOne<{
          id: string;
          user_id: string;
          user_email: string;
          chain_code: string;
          chain_name: string;
          token_symbol: string;
          token_name: string;
          amount: string;
          fee: string;
          net_amount: string;
          to_address: string;
          status: string;
          tx_hash: string | null;
          confirmations: number;
          approved_at: string | null;
          broadcasted_at: string | null;
          completed_at: string | null;
          failure_reason: string | null;
          created_at: string;
        }>(
          `SELECT * FROM v_withdrawals WHERE id = $1`,
          [params.id]
        );

        if (!withdrawal) {
          set.status = 404;
          return { error: 'Withdrawal not found' };
        }

        return {
          id: withdrawal.id,
          userId: withdrawal.user_id,
          userEmail: withdrawal.user_email,
          chainCode: withdrawal.chain_code,
          chainName: withdrawal.chain_name,
          tokenSymbol: withdrawal.token_symbol,
          tokenName: withdrawal.token_name,
          amount: withdrawal.amount,
          feeAmount: withdrawal.fee,
          netAmount: withdrawal.net_amount,
          destinationAddress: withdrawal.to_address,
          status: withdrawal.status,
          txHash: withdrawal.tx_hash,
          confirmations: withdrawal.confirmations,
          approvedAt: withdrawal.approved_at,
          broadcastedAt: withdrawal.broadcasted_at,
          completedAt: withdrawal.completed_at,
          failureReason: withdrawal.failure_reason,
          createdAt: withdrawal.created_at,
        };
      } catch (error) {
        console.error('[DepositsWithdrawals] Withdrawal detail error:', error);
        set.status = 500;
        return { error: 'Failed to fetch withdrawal' };
      }
    }, {
      params: t.Object({ id: t.String() }),
      detail: {
        tags: ['deposits-withdrawals'],
        summary: 'Get withdrawal details',
      }
    })

    .post('/withdrawals/:id/approve', async ({ params, set }) => {
      try {
        const result = await db.queryOne<{ id: string; status: string }>(
          `UPDATE withdrawal_requests 
           SET status = 'approved', approved_at = NOW(), updated_at = NOW()
           WHERE id = $1 AND status = 'pending_approval'
           RETURNING id, status`,
          [params.id]
        );

        if (!result) {
          set.status = 404;
          return { error: 'Withdrawal not found or not pending approval' };
        }

        return { success: true, id: result.id, status: result.status };
      } catch (error) {
        console.error('[DepositsWithdrawals] Approve error:', error);
        set.status = 500;
        return { error: 'Failed to approve withdrawal' };
      }
    }, {
      params: t.Object({ id: t.String() }),
      detail: {
        tags: ['deposits-withdrawals'],
        summary: 'Approve a pending withdrawal',
      }
    })

    .post('/withdrawals/:id/reject', async ({ params, body, set }) => {
      try {
        // Get withdrawal to unlock funds
        const withdrawal = await db.queryOne<{ 
          id: string; 
          user_id: string; 
          asset_id: string;
          amount: string;
        }>(
          `SELECT id, user_id, asset_id, amount 
           FROM withdrawal_requests 
           WHERE id = $1 AND status IN ('pending_approval', 'approved')`,
          [params.id]
        );

        if (!withdrawal) {
          set.status = 404;
          return { error: 'Withdrawal not found or already processed' };
        }

        // Update status to rejected
        await db.execute(
          `UPDATE withdrawal_requests 
           SET status = 'rejected', 
               failed_at = NOW(),
               failure_reason = $2,
               updated_at = NOW()
           WHERE id = $1`,
          [params.id, body.reason || 'Rejected by admin']
        );

        // Unlock user's balance
        await db.execute(
          `UPDATE user_balances 
           SET locked = locked - $1,
               available = available + $1,
               last_updated_at = NOW()
           WHERE user_id = $2 AND asset_id = $3`,
          [withdrawal.amount, withdrawal.user_id, withdrawal.asset_id]
        );

        return { success: true, message: 'Withdrawal rejected and funds unlocked' };
      } catch (error) {
        console.error('[DepositsWithdrawals] Reject error:', error);
        set.status = 500;
        return { error: 'Failed to reject withdrawal' };
      }
    }, {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        reason: t.Optional(t.String()),
      }),
      detail: {
        tags: ['deposits-withdrawals'],
        summary: 'Reject a pending withdrawal',
      }
    })

    // =========================================================================
    // SWEEP OPERATIONS
    // =========================================================================
    .get('/sweeps', async ({ query }) => {
      const page = query.page || 1;
      const pageSize = query.pageSize || 20;
      const offset = (page - 1) * pageSize;

      try {
        let whereClause = 'WHERE 1=1';
        const params: (string | number)[] = [];
        let paramIndex = 1;

        if (query.status) {
          whereClause += ` AND status = $${paramIndex}`;
          params.push(query.status);
          paramIndex++;
        }

        if (query.chainCode) {
          whereClause += ` AND chain_code = $${paramIndex}`;
          params.push(query.chainCode);
          paramIndex++;
        }

        // Get count
        const countResult = await db.queryOne<{ count: string }>(
          `SELECT COUNT(*) as count FROM sweep_operations_view ${whereClause}`,
          params
        );
        const totalItems = parseInt(countResult?.count || '0', 10);

        // Get sweep operations using the view
        const sweeps = await db.query<{
          id: string;
          chain_code: string;
          token_symbol: string;
          from_address: string;
          to_address: string;
          amount: string;
          tx_hash: string | null;
          gas_tx_hash: string | null;
          gas_used: string | null;
          total_gas_cost: string | null;
          status: string;
          scheduled_at: string;
          completed_at: string | null;
          failed_at: string | null;
          failure_reason: string | null;
          retry_count: number;
          block_number: number | null;
        }>(
          `SELECT * FROM sweep_operations_view ${whereClause}
           ORDER BY scheduled_at DESC
           LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
          [...params, pageSize, offset]
        );

        return {
          data: sweeps.map(s => ({
            id: s.id,
            chainCode: s.chain_code,
            tokenSymbol: s.token_symbol,
            fromAddress: s.from_address,
            toAddress: s.to_address,
            amount: s.amount,
            txHash: s.tx_hash,
            gasTxHash: s.gas_tx_hash,
            gasUsed: s.gas_used,
            totalGasCost: s.total_gas_cost,
            status: s.status,
            scheduledAt: s.scheduled_at,
            completedAt: s.completed_at,
            failedAt: s.failed_at,
            failureReason: s.failure_reason,
            retryCount: s.retry_count,
            blockNumber: s.block_number,
          })),
          pagination: {
            page,
            pageSize,
            totalItems,
            totalPages: Math.ceil(totalItems / pageSize),
          },
        };
      } catch (error) {
        console.error('[DepositsWithdrawals] Sweeps list error:', error);
        return {
          data: [],
          pagination: { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 },
        };
      }
    }, {
      query: t.Object({
        page: t.Optional(t.Number({ minimum: 1 })),
        pageSize: t.Optional(t.Number({ minimum: 1, maximum: 100 })),
        status: t.Optional(t.String()),
        chainCode: t.Optional(t.String()),
      }),
      detail: {
        tags: ['deposits-withdrawals'],
        summary: 'List sweep operations',
      }
    })

    // =========================================================================
    // SWEEPER STATUS
    // =========================================================================
    .get('/sweeper/status', async () => {
      try {
        // Get sweeper status from singleton table
        const status = await db.queryOne<{
          is_running: boolean;
          last_run_at: string | null;
          total_swept_24h: string;
          operations_completed_24h: number;
          operations_failed_24h: number;
        }>(
          `SELECT is_running, last_run_at, total_swept_24h, operations_completed_24h, operations_failed_24h 
           FROM sweeper_status WHERE id = 1`
        );

        // Get pending deposits ready to sweep
        const pendingToSweep = await db.queryOne<{ count: string }>(
          `SELECT COUNT(*) as count FROM deposits WHERE status = 'confirmed'`
        );

        // Get active chains with pending operations
        const activeChains = await db.query<{ chain_code: string; count: string }>(
          `SELECT c.code as chain_code, COUNT(*) as count 
           FROM deposits d
           JOIN networks c ON d.network_id = c.id
           WHERE d.status IN ('pending', 'confirming', 'confirmed')
           GROUP BY c.code`
        );

        return {
          isRunning: status?.is_running ?? false,
          lastRunAt: status?.last_run_at ?? null,
          lastSuccessAt: status?.last_run_at ?? null,
          lastError: null,
          lastErrorAt: null,
          totalSwept24h: String(status?.total_swept_24h || 0),
          operationsCompleted24h: status?.operations_completed_24h || 0,
          operationsFailed24h: status?.operations_failed_24h || 0,
          pendingToSweep: parseInt(pendingToSweep?.count || '0', 10),
          activeChains: activeChains.map(c => ({
            chainCode: c.chain_code,
            pendingDeposits: parseInt(c.count, 10),
          })),
        };
      } catch (error) {
        console.error('[DepositsWithdrawals] Sweeper status error:', error);
        return {
          isRunning: false,
          lastRunAt: null,
          lastSuccessAt: null,
          lastError: null,
          lastErrorAt: null,
          totalSwept24h: '0',
          operationsCompleted24h: 0,
          operationsFailed24h: 0,
          pendingToSweep: 0,
          activeChains: [],
        };
      }
    }, {
      detail: {
        tags: ['deposits-withdrawals'],
        summary: 'Get sweeper service status',
      }
    });
}
