// agent.js
const http = require('http');
const { exec } = require('child_process');
const os = require('os');

// This function actually scans your Windows or Mac Task Manager
const scanRealOS = () => {
    return new Promise((resolve) => {
        const platform = os.platform();
        // Use 'tasklist' for Windows, 'ps' for Mac/Linux
        const cmd = platform === 'win32' ? 'tasklist' : 'ps -ax';

        exec(cmd, (err, stdout) => {
            let detected = [];
            if (!err) {
                const out = stdout.toLowerCase();
                
                // Check for real processes running on your computer right now
                if (out.includes('excel')) detected.push('excel');
                
                if (out.includes('winword') || out.includes('acrobat') || out.includes('preview')) {
                    detected.push('docs'); // Maps Word/PDFs to 'docs'
                }
                
                if (out.includes('chrome') || out.includes('firefox') || out.includes('safari') || out.includes('edge')) {
                    detected.push('web'); // Maps browsers to 'web'
                }
                
                if (out.includes('sap')) detected.push('sap');
            }
            resolve(detected);
        });
    });
};

const server = http.createServer(async (req, res) => {
    // CORS headers to allow your Next.js frontend to talk to this local server
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Content-Type', 'application/json');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    if (req.url === '/api/active-apps' && req.method === 'GET') {
        console.log("Scanning OS for running applications...");
        const apps = await scanRealOS();
        console.log(`Detected: ${apps.join(', ') || 'None'}`);
        
        res.writeHead(200);
        res.end(JSON.stringify({ 
            status: "success",
            active_apps: apps 
        }));
    } else {
        res.writeHead(404);
        res.end(JSON.stringify({ error: "Endpoint not found" }));
    }
});

const PORT = 8080;
server.listen(PORT, () => {
    console.log(`🤖 REAL Automato Local OS Agent is running on http://localhost:${PORT}`);
    console.log(`Leave this terminal open. Waiting for dashboard scan requests...`);
});