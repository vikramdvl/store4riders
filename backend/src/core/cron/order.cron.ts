import cron from "node-cron";
import { OrderService } from "../../modules/order/order.service";
import { logger } from "../utils/logger";

export function initCronJobs() {
  // 1. Run every 30 minutes to reconcile stale pending_payment orders with gateways before expiring them
  cron.schedule("*/30 * * * *", async () => {
    logger.info("Running cleanup & S2S reconciliation cron job for stale pending orders...");
    try {
      const count = await OrderService.cleanupAbandonedOrders();
      logger.info(`Cron Job Complete: Expired ${count} stale unconfirmed orders after S2S reconciliation.`);
    } catch (error) {
      logger.error("Failed to run order cleanup cron job", error);
    }
  });

  // 2. Daily EOD Settlement Reconciliation at 02:30 AM IST (recovers late bank captures & alerts on unrefunded failed orders)
  cron.schedule("30 2 * * *", async () => {
    logger.info("Running daily EOD settlement reconciliation cron job...");
    try {
      const metrics = await OrderService.reconcileDailySettlements();
      logger.info(
        `Daily EOD Reconciliation Complete: checked=${metrics.checked}, lateRecovered=${metrics.lateRecovered}, pendingManualRefunds=${metrics.pendingManualRefunds}`
      );
    } catch (error) {
      logger.error("Failed to run daily EOD settlement reconciliation cron job", error);
    }
  });

  // 3. Run every 6 hours (4 times a day) to auto-sync Instagram stats, bio, and latest reels.
  // Preserves Meta API credits, respects rate limits, and prevents unnecessary database write load.
  cron.schedule("0 */6 * * *", async () => {
    if (!process.env.INSTAGRAM_ACCESS_TOKEN) return;
    logger.info("Running automatic Instagram live feed & stats sync cron job (every 6 hours)...");
    try {
      const { HomepageService } = await import("../../modules/homepage/homepage.service");
      await HomepageService.syncInstagramFeed();
      logger.info("Cron Job Complete: Instagram stats, bio, and reels refreshed.");
    } catch (error: any) {
      logger.warn("Automatic Instagram sync cron job failed:", error?.message);
    }
  });
}
