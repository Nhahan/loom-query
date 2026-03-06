/**
 * Next.js instrumentation hook — runs once on server startup.
 * Registers SIGTERM/SIGINT handlers for graceful singleton cleanup.
 * See: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 *
 * Dynamic imports are used so that Node.js-only singleton modules are not
 * statically bundled into the Edge Instrumentation bundle.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const [{ closeDb }, { closeRedis }, { closeChroma }] = await Promise.all([
      import('@/lib/db/client'),
      import('@/lib/redis'),
      import('@/lib/chroma'),
    ]);

    const shutdown = async (signal: string): Promise<void> => {
      console.info(`[instrumentation] received ${signal}, shutting down...`);
      await Promise.allSettled([
        closeRedis(),
        Promise.resolve(closeDb()),
        Promise.resolve(closeChroma()),
      ]);
      console.info('[instrumentation] singletons closed');
      process.exit(0);
    };

    process.once('SIGTERM', () => void shutdown('SIGTERM'));
    process.once('SIGINT', () => void shutdown('SIGINT'));
  }
}
