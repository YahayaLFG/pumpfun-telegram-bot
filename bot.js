const fetch = require('node-fetch');
const { Telegraf } = require('telegraf');

const bot = new Telegraf(process.env.BOT_TOKEN);
const channelId = process.env.CHANNEL_ID;

async function fetchNewTokens() {
  try {
    const response = await fetch('https://api.apify.com/v2/acts/muhammetakkurtt~pump-fun-new-token-transactions-monitor/runs?token=<YOUR_API_TOKEN>');
    const data = await response.json();
    return data.items || [];
  } catch (error) {
    console.error('Error fetching new tokens:', error);
    return [];
  }
}

async function postNewTokens() {
  const newTokens = await fetchNewTokens();

  if (newTokens.length > 0) {
    for (const token of newTokens) {
      const { name, symbol, creator, tokenPage } = token;
      const message = `
🚀 New Token Launched!
Name: ${name}
Symbol: ${symbol}
Creator: ${creator}
Token Page: ${tokenPage}
`;
      await bot.telegram.sendMessage(channelId, message);
    }
  } else {
    console.log('No new tokens found.');
  }
}

setInterval(postNewTokens, 30000); // Check every 30 seconds
