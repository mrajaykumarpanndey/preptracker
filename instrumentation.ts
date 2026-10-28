// Runs the scheduler inside the server process when SCHEDULER_INTERVAL_MINUTES is set (used in Docker,
// where there's no separate `npm run local-cron`). The import must sit directly under this check so the
// Node-only code is left out of the edge bundle.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./lib/scheduler-loop");
  }
}
