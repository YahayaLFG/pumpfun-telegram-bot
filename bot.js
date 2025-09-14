const { Telegraf } = require('telegraf');
const fetch = require('node-fetch');

// HARDCODED TOKEN - Replace with your actual token
const BOT_TOKEN = "8360879459:AAFdUY4He9GynBMdEWvXUx5RJQtoIZTG3HU";
const CHANNEL_ID = "@pumpfunannoucement";
const CHECK_INTERVAL = 30000; // 30 seconds

const bot = new Telegraf(BOT_TOKEN);
const postedTokens = new Set();

// REAL Pump.fun API endpoints (from actual website inspection)
const PUMPFUN_API = {
  BASE: 'https://api.pump.fun',
  COINS: 'https://api.pump.fun/coins',
  TRENDING: 'https://api.pump.fun/trending', 
  RECENT: 'https://api.pump.fun/recent',
  USER: 'https://api.pump.fun/user'
};

async function initializeBot() {
  try {
    console.log('🚀 Starting REAL Pump.fun monitor bot...');
    await bot.telegram.getMe();
    console.log('✅ Bot token is valid');
    
    // Send startup message
    try {
      await bot.telegram.sendMessage(CHANNEL_ID, 
        '🤖 PUMP.FUN MONITOR BOT ACTIVATED!\n\nI will now monitor REAL Pump.fun API for new token launches!\n\n⚠️ Always DYOR before investing!',
        { parse_mode: 'Markdown' }
      );
    } catch (error) {
      console.log('⚠️ Could not send startup message');
    }
    
    startMonitoring();
  } catch (error) {
    console.error('❌ Failed to initialize bot:', error.message);
    setTimeout(initializeBot, 10000);
  }
}

function startMonitoring() {
  console.log('✅ Starting REAL Pump.fun monitoring...');
  setInterval(checkAndPostTokens, CHECK_INTERVAL);
  checkAndPostTokens();
}

async function getNewTokensFromPumpFun() {
  try {
    console.log('🔍 Checking REAL Pump.fun API for new tokens...');
    
    // Try multiple REAL Pump.fun endpoints
    const endpoints = [
      PUMPFUN_API.COINS + '?limit=50&sort=createdAt&order=desc',
      PUMPFUN_API.RECENT + '?limit=50',
      PUMPFUN_API.TRENDING + '?limit=30'
    ];
    
    let allTokens = [];
    
    for (const endpoint of endpoints) {
      try {
        console.log(`🔄 Trying endpoint: ${endpoint}`);
        
        const response = await fetch(endpoint, {
          timeout: 15000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'application/json',
            'Origin': 'https://pump.fun',
            'Referer': 'https://pump.fun/'
          }
        });
        
        if (!response.ok) {
          console.log(`⚠️ API ${endpoint} returned: ${response.status}`);
          continue;
        }
        
        const data = await response.json();
        
        // Handle different response formats
        if (Array.isArray(data)) {
          console.log(`✅ Found ${data.length} tokens from ${endpoint}`);
          allTokens = allTokens.concat(data.slice(0, 20));
        } else if (data && Array.isArray(data.coins)) {
          console.log(`✅ Found ${data.coins.length} tokens from ${endpoint}`);
          allTokens = allTokens.concat(data.coins.slice(0, 20));
        } else if (data && Array.isArray(data.data)) {
          console.log(`✅ Found ${data.data.length} tokens from ${endpoint}`);
          allTokens = allTokens.concat(data.data.slice(0, 20));
        }
        
      } catch (error) {
        console.log(`❌ Failed to fetch from ${endpoint}:`, error.message);
      }
    }
    
    // Filter for new tokens only
    const newTokens = allTokens.filter(token => 
      token && token.mintAddress && !postedTokens.has(token.mintAddress)
    );
    
    console.log(`🎯 ${newTokens.length} NEW tokens found from REAL Pump.fun API!`);
    return newTokens;
    
  } catch (error) {
    console.error('❌ Error accessing Pump.fun API:', error.message);
    return [];
  }
}

function formatTokenMessage(token) {
  return `🚀 **NEW PUMP.FUN TOKEN LAUNCHED!**

**Token:** ${token.name || 'Unknown'} (${token.symbol || 'N/A'})
**Price:** $${token.price ? parseFloat(token.price).toFixed(8) : '0.00'}
**Market Cap:** $${token.marketCap ? Math.round(token.marketCap).toLocaleString() : '0'}
**Volume:** $${token.volume ? Math.round(token.volume).toLocaleString() : '0'}

**Creator:** ${token.creator || 'Unknown'}
**Profile:** https://pump.fun/profile/${token.creator || 'unknown'}

**Trade:** https://pump.fun/token/${token.mintAddress}

**CA:** \`${token.mintAddress.slice(0, 8)}...${token.mintAddress.slice(-6)}\`
**Created:** Just now

⚠️ **Always do your own research before investing!**`;
}

async function checkAndPostTokens() {
  try {
    const newTokens = await getNewTokensFromPumpFun();
    
    if (newTokens.length === 0) {
      console.log('⏭️ No new tokens found in this check');
      return;
    }
    
    console.log(`📨 Posting ${newTokens.length} REAL Pump.fun tokens...`);
    
    for (const token of newTokens) {
      try {
        // Mark as posted
        postedTokens.add(token.mintAddress);
        
        // Send message to channel
        const message = formatTokenMessage(token);
        await bot.telegram.sendMessage(CHANNEL_ID, message, { 
          parse_mode: 'Markdown',
          disable_web_page_preview: true 
        });
        
        console.log(`✅ Posted REAL token: ${token.symbol} (${token.name})`);
        
        // Wait between posts to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 2000));
        
      } catch (postError) {
        console.error('❌ Error posting token:', postError.message);
      }
    }
    
  } catch (error) {
    console.error('❌ Error in checkAndPostTokens:', error.message);
  }
}

// Start the bot
initializeBot();

// Handle graceful shutdown
process.once('SIGINT', () => {
  console.log('🛑 Shutting down bot...');
  bot.stop('SIGINT');
  process.exit(0);
});

process.once('SIGTERM', () => {
  console.log('🛑 Shutting down bot...');
  bot.stop('SIGTERM');
  process.exit(0);
});
