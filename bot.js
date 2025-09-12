const { Telegraf } = require('telegraf');
const fetch = require('node-fetch');

// Get configuration from environment variables
const BOT_TOKEN = process.env.BOT_TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;
const CHECK_INTERVAL = process.env.CHECK_INTERVAL || 30000;

const bot = new Telegraf(BOT_TOKEN);

// Track already posted tokens to avoid duplicates
const postedTokens = new Set();

async function getNewTokens() {
  try {
    console.log('Checking for new tokens...');
    const response = await fetch('https://api.pump.fun/tokens?limit=10');
    const tokens = await response.json();
    
    // Filter for very new tokens (created in the last minute)
    const newTokens = tokens.filter(token => {
      const createdTime = new Date(token.createdAt).getTime();
      const isNew = (Date.now() - createdTime) < 120000; // 2 minutes
      return isNew && !postedTokens.has(token.mintAddress);
    });
    
    return newTokens;
  } catch (error) {
    console.error('Error fetching tokens:', error);
    return [];
  }
}

function formatTokenMessage(token) {
  return `🚀 NEW PUMP.FUN TOKEN LAUNCHED!

Token: ${token.name} (${token.symbol})
Price: $${token.price}
Market Cap: $${token.marketCap}

Creator: ${token.creator}
Profile: https://pump.fun/profile/${token.creator}

Trade: https://pump.fun/token/${token.mintAddress}

CA: ${token.mintAddress.slice(0, 10)}...${token.mintAddress.slice(-8)}
Created: Just now

⚠️ Always do your own research before investing!`;
}

async function checkAndPostTokens() {
  try {
    const newTokens = await getNewTokens();
    
    for (const token of newTokens) {
      // Mark as posted
      postedTokens.add(token.mintAddress);
      
      // Send message to channel
      const message = formatTokenMessage(token);
      await bot.telegram.sendMessage(CHANNEL_ID, message, { parse_mode: 'Markdown' });
      
      console.log(`Posted new token: ${token.symbol}`);
      
      // Wait a moment between posts
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  } catch (error) {
    console.error('Error in checkAndPostTokens:', error);
  }
}

// Start checking
console.log('Starting Pump.fun monitor bot...');
setInterval(checkAndPostTokens, CHECK_INTERVAL);
checkAndPostTokens(); // Initial check

// Handle graceful shutdown
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
