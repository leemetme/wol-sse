const express = require('express');
const app = express();

const HTTP_PORT = process.env.HTTP_PORT ?? 8093;

/**
 * @typedef {Object} ConfigObj
 * @property {string} bearer - The 'token' for this configuration to authorize yourself with.
 * @property {Array<String>} [macs] - Optionally, you can provide an allowlist of MAC addresses.
 * If omitted, any MAC address is allowed.
 */

/**
 * The `config` variable holds the entire configuration for the script.
 * The key is the 'name' of an configuration,
 * where the value is an ConfigObj.
 * @type {Object<string, ConfigObj>}
 */
const config = {
    "EXAMPLE-1": {
        bearer: "CHANGE_ME",  // provide this bearer token in your http request to turn on your device
    },
    "EXAMPLE-2": {
        bearer: "CHANGE_ME_2",  // make sure bearer tokens are unique across the configuration
        macs: ["AA:AA:AA:AA:AA:AA"]  // for EXAMPLE-2, we can only turn on MAC addresses that are in this list
    }
}

function log(str) {
    console.log(`[${new Date().toISOString()}] ${str}`);
}

/**
 * The list of clients that are currently listening for events.
 * Each object in this list contains...
 * - `id` - a number, which is the unix timestamp in milliseconds to identify this listener
 * - `name` - a string to identify which configuration it is listening for
 * - `res` - an Express response object for the request that initiated this listener
 * @type {Array<{id: Number, name: string, res: express.Response}>}
 */
let listenerClients = [];

/**
 * Write a message to **all** clients that are listening.
 * @param {*} data - The message to be written to all listening clients
 */
function writeToAllClients(data) {
    listenerClients.forEach(client=>{
        client.res.write(data);
    })
}

const pingEvent = setInterval(function (){
    writeToAllClients(`data: PING\n\n`)
}, 1000);

const authMiddleware = (req, res, next) => {
    if (!req.headers.authorization || !req.headers.authorization.startsWith("Bearer ")) {
        log(`denied access to ${req.ip}`);
        res.sendStatus(401);
        return;
    }

    const token = req.headers.authorization.substring(7);
    
    let tokenName;
    for (const name of Object.keys(config)) {
        if (token == config[name].bearer) {
            tokenName = name;
        }
    }

    if (!tokenName) {
        log(`denied access to ${req.ip}`);
        res.sendStatus(401);
        return;
    }

    req.wol_name = tokenName;
    next()
}

app.post('/sse/:mac/on', authMiddleware, async (req, res) => {
    const clients = listenerClients.filter(el => el.name == req.wol_name)
    const configObj = config[req.wol_name];

    if (clients.length == 0) {
        res.sendStatus(503);
        return;
    }
    
    if (configObj.macs && !configObj.macs.includes(req.params.mac)) {
        res.sendStatus(403);
        return;
    }
    
    clients.forEach(client => client.res.write(`data: SEND_PACKET_TO_MAC ${req.params.mac}\n\n`));
    res.sendStatus(204);
})

app.get('/sse/status', async (req, res)=>{
    res.send({listenerCount: listenerClients.length});
})

app.get('/sse/events', authMiddleware, async (req, res, next)=>{
    const headers = {
        "Content-Type": "text/event-stream",
        "Connection": "keep-alive",
        "Cache-Control": "no-cache",
    }
    res.writeHead(200, headers);

    const myId = Date.now();
    const myClientObj = {id: myId, name: req.wol_name, res};
    listenerClients.push(myClientObj);

    log(`[${req.wol_name}] new listener connection!`);
    res.write(`data: CONNECTED\n\n`);

    req.on('close', () => {
        log(`[${req.wol_name}] ${new Date(myId).toISOString()} listener connection closed, goodbye.`);
        listenerClients = listenerClients.filter(client => client.id !== myId);
    });
})

app.listen(HTTP_PORT, ()=>{
    log(`http://wol.leemet.me (sse) service listening on port ${HTTP_PORT}`)
});
