const http = require('http');
const fs = require('fs');
const path = require('path');
var last_qr = "";
const { Client, Location } = require('whatsapp-web.js');
const { parse } = require('querystring');
const SESSION_FILE_PATH = './session.json';
let sessionCfg;
if (fs.existsSync(SESSION_FILE_PATH)) {
    sessionCfg = require(SESSION_FILE_PATH);
}

const client = new Client({ pupeteer: { headless: true }, session: sessionCfg });

client.initialize();

client.on('qr', (qr) => {
    last_qr = qr;
});

client.on('authenticated', (session) => {
    console.log("AUTH!", session);
    sessionCfg = session;
    fs.writeFile(SESSION_FILE_PATH, JSON.stringify(session), function(err) {
        if (err) {
            console.error(err);
        }
    })
});
client.on('disconnected', (reason) => {
    console.log('Client was logged out', reason);
});

const server = http.createServer();

server.on('request', async(req, res) => {
    console.log("URL", req.url);
    if (req.url === "/get_qr") {
        console.log("QR", last_qr);
        if (last_qr !== "") {
            res.end(JSON.stringify({ 'Success': true, 'Content': last_qr }));
        }
        res.end(JSON.stringify({ 'Success': false, 'Content': 'There is no qr code available (try again later)' }));
    } else if (req.url === "/state") {
        client.getState().then((state) => {
            res.end(JSON.stringify({ 'Success': true, 'Content': state }))
        }).catch(() => {
            if (last_qr !== "") {
                res.end(JSON.stringify({ 'Success': true, 'Content': 'ks_login_needed' }))
            }
            res.end(JSON.stringify({ 'Success': false, 'Content': 'failed to get state!' }))
        })
    } else if (req.url === "/get_chat") {
        let body = '';
        req.on('data', async(chunk) => {
            body += chunk.toString();
        })
        req.on('end', async() => {
            let bodyParsed = parse(body);

            let chat_id = bodyParsed['chat_id'];
            if (chat_id === undefined) {
                res.end(JSON.stringify({ "Success": false, "Content": "Missing data!" }));
            }
            console.log("chat_id", chat_id);

            client.getChatById(chat_id).then((chat) => {
                res.end(JSON.stringify({ 'Success': true, 'Content': "Returned chat!", 'AddonData': JSON.stringify(chat) }));
            }).catch(() => {
                console.error("getchaterror")
                res.end(JSON.stringify({ 'Success': false }))
            })
        })
    } else if (req.url === "/get_info") {
        res.end(JSON.stringify({ "Success": true, "Content": "Returned info", "AddonData": JSON.stringify(client.info) }));
    } else if (req.url === "/get_messages") {
        let body = '';
        req.on('data', async(chunk) => {
            body += chunk.toString();
        });
        req.on('end', async() => {
            let bodyParsed = parse(body);

            let chat_id = bodyParsed['chat_id'];
            let messages_count = bodyParsed['messages_count'];
            if (chat_id === undefined || messages_count === undefined) {
                res.end(JSON.stringify({ "Success": false, "Content": "Missing data!" }));
            }
            console.log("chat_id", chat_id);
            console.log("messages_count", messages_count);

            client.getChatById(chat_id).then((chat) => {
                client.sendSeen(chat_id);
                chat.fetchMessages({ limit: parseInt(messages_count) }).then((messages) => {
                    console.log("messages", messages);
                    res.end(JSON.stringify({ 'Success': true, 'Content': "Returned messages", 'AddonData': JSON.stringify(messages) }))
                }).catch((ex) => {
                    console.error("Error fetchmessages", ex);
                    res.end(JSON.stringify({ 'Success': false, 'Content': 'failedfetchmessages' }))
                })
            }).catch((ex) => {
                console.error("Error getchatbyid", ex);
                res.end(JSON.stringify({ 'Success': false, 'Content': "failedgetchatbyid" }));
            })
        })
    } else if (req.url === "/send_message") {
        let body = '';
        req.on('data', async(chunk) => {
            body += chunk.toString();
        });
        req.on('end', async() => {
            let bodyParsed = parse(body);

            let chat_id = bodyParsed['chat_id'];
            let message = bodyParsed['message'];
            if (chat_id === undefined || message === undefined) {
                res.end(JSON.stringify({ "Success": false, "Content": "Missing data!" }));
            }
            console.log("chat_id", chat_id);
            console.log("message", message);

            client.getChatById(chat_id).then((chat) => {
                chat.sendMessage(message).then((msg) => {
                        console.log(msg);
                        res.end(JSON.stringify({ 'Success': true, 'Content': "Returned message!", 'AddonData': JSON.stringify(msg) }))
                    })
                    .catch(() => {
                        console.error("error sendmessage");
                        res.end(JSON.stringify({ 'Success': false, 'Content': 'failedsendmessage' }))
                    })
            }).catch((ex) => {
                console.error("Error getchatbyid", ex);
                res.end(JSON.stringify({ 'Success': false, 'Content': "failedgetchatbyid" }));
            })
        })
    }
})
server.listen(5002, "localhost");