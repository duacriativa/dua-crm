async function run() {
  try {
    const res = await fetch('http://62.238.2.151/webhook/find/dua-criativa', {
      headers: { apikey: 'B6D711FCDE4D4FD5936544120E713976' }
    });
    const data = await res.json();
    console.log("Find Webhook Response:", JSON.stringify(data, null, 2));
  } catch (e) {
    console.error("Error:", e.message);
  }
}
run();
