const http = require('http');
const fs = require('fs');
const path = require('path');
var last_qr = "";
const {Client, Location} = require('whatsapp-web.js');
const {parse} = require('querystring');
const SESSION_FILE_PATH = './session.json';
let sessionCfg;
if(fs.existsSync(SESSION_FILE_PATH))
{
    sessionCfg = require(SESSION_FILE_PATH);
}

const client = new Client({pupeteer: {headless: true}, session: sessionCfg});

client.initialize();

client.on('qr', (qr)=>{
    last_qr = qr;
});

client.on('authenticated', (session) =>{
    console.log("AUTH!", session);
    sessionCfg = session;
    fs.writeFile(SESSION_FILE_PATH, JSON.stringify(session), function(err){
        if(err){
            console.error(err);
        }
    })
});
client.on('disconnected', (reason) => {
    console.log('Client was logged out', reason);
});

const server = http.createServer();

server.on('request', async (req, res) => {
    console.log("URL", req.url);
    if(req.url === "/get_qr")
    {
        console.log("QR", last_qr);
       if(last_qr !== "")
       {
           res.end(JSON.stringify({'success':true, 'data': last_qr}));
       }
       res.end(JSON.stringify({'success':false,'data':false}));
    }
    else if(req.url === "/state")
    {
        const state = await client.getState();
        console.log("STATE", state);
        res.end(JSON.stringify({'success':true,'data':state}));
    }
    else if(req.url === "/get_chat")
    {
        let body = '';
        req.on('data', async(chunk) => {
            body += chunk.toString();
        })
        req.on('end', async()=>{
            let bodyParsed = parse(body);

            let chat_id = bodyParsed['chat_id'];
            if(chat_id === undefined)
            {
                res.end(JSON.stringify({"success":false, "data": "Missing data!"}));
            }
            console.log("chat_id", chat_id);

            client.getChatById(chat_id).then((chat) => {
                res.end(JSON.stringify({'success':true, 'data':chat}));
            }).catch(()=>{
                console.error("getchaterror")
                res.end(JSON.stringify({'success':false}))
            })
        })
    }
    else if(req.url === "/get_messages")
    {
        let body = '';
        req.on('data', async(chunk) => {
            body += chunk.toString();
        });
        req.on('end', async() => {
            let bodyParsed = parse(body);

            let chat_id = bodyParsed['chat_id'];
            let messages_count = bodyParsed['messages_count'];
            if(chat_id === undefined || messages_count === undefined)
            {
                res.end(JSON.stringify({"success":false, "data":"Missing data!"}));
            }
            console.log("chat_id",chat_id);
            console.log("messages_count", messages_count);
            
            client.getChatById(chat_id).then((chat)=>{
                client.sendSeen(chat_id);
                chat.fetchMessages({limit: parseInt(messages_count)}).then((messages) => {

                    res.end(JSON.stringify({'success':true, 'data': messages}))
                }).catch(()=>{
                    console.error("Error fetchmessages");
                    res.end(JSON.stringify({'success': false, 'data':'failedfetchmessages'}))
                })
            }).catch(()=>{
                console.error("Error getchatbyid");
                res.end(JSON.stringify({'success':false,'data':"failedgetchatbyid"}));
            })
        })
    }
    else if(req.url === "/send_message")
    {
        let body = '';
        req.on('data', async(chunk) => {
            body += chunk.toString();
        });
        req.on('end', async() => {
            let bodyParsed = parse(body);

            let chat_id = bodyParsed['chat_id'];
            let message = bodyParsed['message'];
            if(chat_id === undefined || message === undefined)
            {
                res.end(JSON.stringify({"success":false, "data":"Missing data!"}));
            }
            console.log("chat_id",chat_id);
            console.log("message", message);
            
            client.getChatById(chat_id).then((chat)=>{
                chat.sendMessage(message).then((msg) => {
                    res.end(JSON.stringify({'success':true,'data':msg}))
                })
                .catch(()=>{
                    console.error("error sendmessage");
                    res.end(JSON.stringify({'success':false, 'data':'failedsendmessage'}))
                })
            }).catch(()=>{
                console.error("Error getchatbyid");
                res.end(JSON.stringify({'success':false,'data':"failedgetchatbyid"}));
            })
        })
    }
})
server.listen(3000);
