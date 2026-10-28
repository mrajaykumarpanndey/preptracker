// Runs the scheduler every 15 minutes while `npm run dev` / `npm start` is running.
const url = `${(process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "")}/api/cron`;
const everyMinutes = 15;

async function tick() {
  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` } });
    console.log(new Date().toLocaleString(), res.status, await res.text());
  } catch (error) {
    console.error(new Date().toLocaleString(), "Scheduler call failed:", error.message);
  }
}

tick();
setInterval(tick, everyMinutes * 60_000);
