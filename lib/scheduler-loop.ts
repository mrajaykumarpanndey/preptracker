import { runScheduler } from "./scheduler";

const minutes = Number(process.env.SCHEDULER_INTERVAL_MINUTES);

if (minutes > 0) {
  const tick = async () => {
    try {
      console.log(new Date().toISOString(), "scheduler", JSON.stringify(await runScheduler()));
    } catch (error) {
      console.error(new Date().toISOString(), "scheduler failed", error);
    }
  };
  setTimeout(tick, 30_000);
  setInterval(tick, minutes * 60_000);
}
