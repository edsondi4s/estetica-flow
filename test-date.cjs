const appDateStr = "2026-03-19";
const appTimeStr = "10:40:00";
const appDateTimeUTC = new Date(`${appDateStr}T${appTimeStr}Z`);
console.log("Before +3h:", appDateTimeUTC.toISOString());

appDateTimeUTC.setTime(appDateTimeUTC.getTime() + 3 * 3600 * 1000);
console.log("After +3h:", appDateTimeUTC.toISOString());

// now simulated as 10:15 BRT = 13:15 UTC
const now = new Date("2026-03-19T13:15:00Z");

const diffMs = appDateTimeUTC.getTime() - now.getTime();
const diffMins = Math.floor(diffMs / 60000);
console.log("Diff Mins:", diffMins);
