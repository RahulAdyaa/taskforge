require('/Users/rahuladya/Documents/taskforge/node_modules/dotenv').config({ path: '/Users/rahuladya/Documents/taskforge/apps/api/.env' });
const jwt = require('jsonwebtoken');
const axios = require('axios');

async function test() {
  try {
    const jwtSecret = process.env.JWT_SECRET;
    const payload = { userId: '6a159a97bb6684b44d0bb8f0', email: 'rahuladyayt@gmail.com' };
    const token = jwt.sign(payload, jwtSecret, { expiresIn: '15m' });

    const response = await axios.get('http://127.0.0.1:3001/api/projects/6a1729b7e409485ff9cfcdca', {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    console.log("Response status:", response.status);
    console.log("Project name:", JSON.stringify(response.data?.name));
    console.log("Project raw data:", JSON.stringify(response.data));
    
    process.exit(0);
  } catch (err) {
    console.error("API Request Error:", err.message);
    if (err.response) {
      console.error("API Response Data:", err.response.data);
    }
    process.exit(1);
  }
}

test();
