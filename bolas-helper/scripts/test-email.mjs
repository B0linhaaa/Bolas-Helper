const url = (process.env.APP_URL || "http://localhost:3001").replace(/\/$/, "");
const secret = process.env.CRON_SECRET || "bolas-helper-local";

const res = await fetch(`${url}/api/notify-odds?test=1`, {
  headers: { authorization: `Bearer ${secret}` },
  cache: "no-store",
});
const body = await res.text();
console.log(res.status, body);
if (!res.ok) process.exit(1);
