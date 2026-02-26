const https = require('https');
const fs = require('fs');

// Your exact Firebase Database URL host
const FIREBASE_HOST = "dj-s-cricket-bingo-default-rtdb.firebaseio.com";

// Read which file you want to upload from the terminal command
const targetFile = process.argv[2]; 

if (!targetFile) {
    console.error("❌ ERROR: Please tell me which file to upload! (e.g., node deploy.js daily-ready.json)");
    process.exit(1);
}

try {
    const rawData = fs.readFileSync(targetFile, 'utf8');
    console.log(`🚀 Securely PATCHING ${targetFile} to Firebase...`);

    // The 'PATCH' method merges data instead of overwriting the whole database!
    const options = {
        hostname: FIREBASE_HOST,
        path: '/.json',
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(rawData)
        }
    };

    const req = https.request(options, (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
            console.log(`✅ SUCCESS! ${targetFile} is live. Your other game modes are perfectly safe!`);
        } else {
            console.error(`❌ FIREBASE REJECTED IT! Status: ${res.statusCode}. Did you set '.write': true in Rules?`);
        }
    });

    req.on('error', (e) => {
        console.error("❌ Network Error:", e);
    });

    req.write(rawData);
    req.end();

} catch (err) {
    console.error(`❌ Could not find ${targetFile}. Are you sure it is in the admin-tools folder?`);
}