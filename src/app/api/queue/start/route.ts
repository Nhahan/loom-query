import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { ensureWorkerStarted, isWorkerRunning } from '@/lib/queue/worker-manager';
import { logger } from '@/lib/logger';

/**
 * Admin token check for queue operations
 * This endpoint should only be accessible to authorized admin users
 *
 * In development: Always allowed (NODE_ENV !== 'production')
 * In production: Requires Authorization header with admin secret (timing-safe comparison)
 */
function isAdminAuthorized(req: NextRequest): boolean {
  // Allow in development mode
  if (process.env.NODE_ENV !== 'production') {
    return true;
  }

  // In production, require authorization header
  const adminSecret = process.env.QUEUE_ADMIN_SECRET;
  if (!adminSecret) {
    logger.warn('QUEUE_ADMIN_SECRET not set in production');
    return false;
  }

  const authHeader = req.headers.get('authorization');
  if (!authHeader) {
    return false;
  }

  // Expect: Authorization: Bearer <secret>
  const token = authHeader.split(' ')[1];

  // Use timing-safe comparison to prevent timing attacks
  try {
    return timingSafeEqual(
      Buffer.from(token || ''),
      Buffer.from(adminSecret)
    );
  } catch {
    // timingSafeEqual throws if buffer lengths differ
    return false;
  }
}

/**
 * POST /api/queue/start
 * Start the embedding processor worker (admin/testing only)
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  // Check authorization
  if (!isAdminAuthorized(req)) {
    return NextResponse.json(
      {
        success: false,
        message: 'Unauthorized: Admin access required',
      },
      { status: 403 }
    );
  }

  try {
    await ensureWorkerStarted();

    return NextResponse.json(
      {
        success: true,
        message: 'Embedding processor worker started',
        running: isWorkerRunning(),
      },
      { status: 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('Failed to start worker', { error: message });

    return NextResponse.json(
      {
        success: false,
        message: 'Failed to start worker',
        error: message,
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/queue/start
 * Check if worker is running (admin/testing only)
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  // Check authorization
  if (!isAdminAuthorized(req)) {
    return NextResponse.json(
      {
        success: false,
        message: 'Unauthorized: Admin access required',
      },
      { status: 403 }
    );
  }

  return NextResponse.json(
    {
      running: isWorkerRunning(),
      message: isWorkerRunning()
        ? 'Embedding processor worker is running'
        : 'Embedding processor worker is not running',
    },
    { status: 200 }
  );
}
