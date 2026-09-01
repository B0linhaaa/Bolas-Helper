const url = (process.env.APP_URL || "http://localhost:3001").replace(/\/$/, "");
const secret = process.env.CRON_SECRET || "";
const minutes = Number(process.env.ODDS_WATCH_MINUTES || "15");

async function tick() {
  const headers = secret ? { authorization: `Bearer ${secret}` } : {};
  const res = await fetch(`${url}/api/notify-odds`, { headers, cache: "no-store" });
  const body = await res.text();
  console.log(new Date().toISOString(), res.status, body);
}

console.log(`A vigiar odds a cada ${minutes} min → ${url}/api/notify-odds`);
console.log("Mantém `npm run dev` a correr. Ctrl+C para parar.");
await tick();
setInterval(tick, minutes * 60 * 1000);
