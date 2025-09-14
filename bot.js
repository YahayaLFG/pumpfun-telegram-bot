const fetch = require('node-fetch');
const cheerio = require('cheerio');
const { Telegraf } = require('telegraf');

// Load Telegram info from Railway environment variables
const BOT_TOKEN = process.env.BOT_TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;

const bot = new Telegraf(BOT_TOKEN);

// Keep track of sent launches
const sentTokens = new Set();

// Function to fetch Pump.fun launches
async function fetchPumpFunLaunches() {
    const url = 'https://pump.fun/new-launches'; // check URL, update if needed
    try {
        const response = await fetch(url);
        const html = await response.text();
        const $ = cheerio.load(html);

        const launches = [];
        $('div.launch-card').each((i, elem) => {
            const name = $(elem).find('h2').text().trim();
            const symbol = $(elem).find('.token-symbol').text().trim();
            const creator = $(elem).find('a.creator-link').attr('href');
            const tokenPage = $(elem).find('a.token-link').attr('href');
            launches.push({ name, symbol, creator, tokenPage });
        });
        return launches;
    } catch (error) {
        console.error('Failed to fetch launches:', error);
        return [];
    }
}

// Function to send launches to Telegram
async function sendLaunchesToTelegram() {
    const launches = await fetchPumpFunLaunches();
    for (const launch of launches) {
        if (!sentTokens.has(launch.symbol)) {
            sentTokens.add(launch.symbol);
            const message = `
🚀 New Pump.fun Launch!
Token: ${launch.name} (${launch.symbol})
Creator: ${launch.creator || 'No creator link'}
Token Page: ${launch.tokenPage || 'No link'}
`;
            try {
                await bot.telegram.sendMessage(CHANNEL_ID, message);
                console.log(`Sent launch: ${launch.name}`);
            } catch (err) {
                console.error('Failed to send Telegram message:', err);
            }
        }
    }
}

// Run the bot every 60 seconds
setInterval(sendLaunchesToTelegram, 60 * 1000);

console.log('Pump.fun Telegram bot started...');
