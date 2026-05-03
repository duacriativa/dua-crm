const axios = require('axios');
async function test() {
  try {
    const res = await axios.get('http://62.238.2.151/instance/connectionState/dua-criativa', {
      headers: { apikey: 'B6D711FCDE4D4FD5936544120E713976' }
    });
    console.log(JSON.stringify(res.data, null, 2));
  } catch (err) {
    console.error(err.message);
  }
}
test();
