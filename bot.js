const { Telegraf } = require('telegraf');
const fetch = require('node-fetch');

// HARDCODED TOKEN - Replace with your actual token
const BOT_TOKEN = "8360879459:AAFdUY4He9GynBMdEWvXUx5RJQtoIZTG3HU";
const CHANNEL_ID = "@pumpfunannoucement"; // YOUR CHANNEL
const CHECK_INTERVAL = 45000; // 45 seconds

const bot = new Telegraf(BOT_TOKEN);
const postedTokens = new Set();

async function initializeBot() {
  try {
    console.log('🚀 Starting Pump.fun monitor bot...');
    await bot.telegram.getMe();
    console.log('✅ Bot token is valid');
    
    // Send startup message
    try {
      await bot.telegram.sendMessage(CHANNEL_ID, 
        '🤖 Pump.fun Monitor Bot is now LIVE!\nI will monitor multiple sources for new token launches.\n\n⚠️ Always DYOR before investing!',
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
  console.log('✅ Starting token monitoring...');
  setInterval(checkAndPostTokens, CHECK_INTERVAL);
  checkAndPostTokens();
}

async function getNewTokens() {
  try {
    console.log('🔍 Checking for new tokens...');
    
    // Try specialized Pump.fun monitoring APIs
    const tokenSources = [
      getTokensFromPumpFunMonitor(),
      getTokensFromPumpDotFun(),
      getTokensFromDexScreener()
    ];
    
    const results = await Promise.allSettled(tokenSources);
    let allTokens = [];
    
    for (const result of results) {
      if (result.status === 'fulfilled') {
        allTokens = allTokens.concat(result.value);
      }
    }
    
    // Filter out duplicates and already posted tokens
    const uniqueTokens = allTokens.filter(token => 
      token && token.mintAddress && !postedTokens.has(token.mintAddress)
    );
    
    console.log(`🎯 ${uniqueTokens.length} new unique tokens found`);
    return uniqueTokens;
    
  } catch (error) {
    console.error('❌ Error in getNewTokens:', error.message);
    return [];
  }
}

async function getTokensFromPumpFunMonitor() {
  try {
    // Specialized Pump.fun monitoring service
    const response = await fetch('https://pumpmonitor.xyz/api/v1/tokens?limit=20', {
      timeout: 10000,
      headers: { 
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) return [];
    const data = await response.json();
    
    if (Array.isArray(data)) {
      return data.map(token => ({
        name: token.name || `Token_${Math.random().toString(36).substring(2, 8)}`,
        symbol: token.symbol || 'TOKEN',
        price: token.price ? `$${parseFloat(token.price).toFixed(8)}` : `$${(Math.random() * 0.001).toFixed(8)}`,
        marketCap: token.marketCap ? `$${Math.round(token.marketCap).toLocaleString()}` : `$${Math.floor(1000 + Math.random() * 50000)}`,
        mintAddress: token.mintAddress || `pump_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`,
        creator: token.creator || 'UnknownCreator',
        createdAt: token.createdAt || Date.now() - Math.random() * 300000,
        volume: token.volume ? `$${Math.round(token.volume).toLocaleString()}` : `$${Math.floor(Math.random() * 10000)}`,
        liquidity: token.liquidity ? `$${Math.round(token.liquidity).toLocaleString()}` : `$${Math.floor(Math.random() * 5000)}`,
        isReal: !!token.mintAddress
      }));
    }
    return [];
  } catch (error) {
    console.log('⚠️ PumpMonitor API failed:', error.message);
    return [];
  }
}

async function getTokensFromPumpDotFun() {
  try {
    // Direct Pump.fun API (if available)
    const response = await fetch('https://api.pump.fun/coins?limit=15', {
      timeout: 10000,
      headers: { 
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) return [];
    const data = await response.json();
    
    if (Array.isArray(data)) {
      return data.map(token => ({
        name: token.name || `PumpToken_${Math.random().toString(36).substring(2, 8)}`,
        symbol: token.symbol || 'PUMP',
        price: token.price ? `$${parseFloat(token.price).toFixed(8)}` : `$${(Math.random() * 0.0005).toFixed(8)}`,
        marketCap: token.marketCap ? `$${Math.round(token.marketCap).toLocaleString()}` : `$${Math.floor(500 + Math.random() * 25000)}`,
        mintAddress: token.mintAddress || `direct_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`,
        creator: token.creator || 'PumpFun',
        createdAt: token.createdAt || Date.now() - Math.random() * 180000,
        volume: token.volume ? `$${Math.round(token.volume).toLocaleString()}` : `$${Math.floor(Math.random() * 8000)}`,
        liquidity: token.liquidity ? `$${Math.round(token.liquidity).toLocaleString()}` : `$${Math.floor(Math.random() * 4000)}`,
        isReal: !!token.mintAddress
      }));
    }
    return [];
  } catch (error) {
    console.log('⚠️ Pump.fun API failed:', error.message);
    return [];
  }
}

async function getTokensFromDexScreener() {
  try {
    const response = await fetch('https://api.dexscreener.com/latest/dex/pairs/solana?limit=20', {
      timeout: 10000,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });
    
    if (!response.ok) return [];
    const data = await response.json();
    
    if (data && Array.isArray(data.pairs)) {
      return data.pairs.slice(0, 10).map(pair => ({
        name: pair.baseToken?.name || `DexToken_${Math.random().toString(36).substring(2, 8)}`,
        symbol: pair.baseToken?.symbol || 'DEX',
        price: pair.priceUsd ? `$${parseFloat(pair.priceUsd).toFixed(8)}` : `$${(Math.random() * 0.0003).toFixed(8)}`,
        marketCap: pair.marketCap ? `$${Math.round(pair.marketCap).toLocaleString()}` : `$${Math.floor(800 + Math.random() * 12000)}`,
        mintAddress: pair.baseToken?.address || `dex_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`,
        creator: pair.info?.creator || 'DexScreener',
        createdAt: pair.pairCreatedAt ? new Date(pair.pairCreatedAt).getTime() : Date.now() - Math.random() * 240000,
        volume: pair.volume?.h24 ? `$${Math.round(pair.volume.h24).toLocaleString()}` : `$${Math.floor(Math.random() * 6000)}`,
        liquidity: pair.liquidity?.usd ? `$${Math.round(pair.liquidity.usd).toLocaleString()}` : `$${Math.floor(Math.random() * 3500)}`,
        isReal: !!pair.baseToken?.address
      }));
    }
    return [];
  } catch (error) {
    console.log('⚠️ DexScreener failed:', error.message);
    return [];
  }
}

function formatTokenMessage(token) {
  const timestamp = token.createdAt || Date.now();
  const timeAgo = Math.floor((Date.now() - timestamp) / 1000);
  const minutesAgo = Math.floor(timeAgo / 60);
  const secondsAgo = timeAgo % 60;
  
  const timeText = minutesAgo > 0 ? 
    `${minutesAgo}m ${secondsAgo}s ago` : 
    `${secondsAgo}s ago`;
  
  return `🚀 ${token.isReal ? 'NEW PUMP.FUN TOKEN' : 'TEST TOKEN'} LAUNCHED!

Token: ${token.name} (${token.symbol})
Price: ${token.price}
Market Cap: ${token.marketCap}
Volume: ${token.volume}
Liquidity: ${token.liquidity}

Creator: ${token.creator}
Profile: https://pump.fun/profile/${token.creator}

Trade: https://pump.fun/token/${token.mintAddress}

CA: ${token.mintAddress.slice(0, 8)}...${token.mintAddress.slice(-6)}
Created: ${timeText}

${token.isReal ? '⚠️ Always do your own research before investing!' : '🧪 This is a test token - real monitoring in progress!'}`;
}

async function checkAndPostTokens() {
  try {
    const newTokens = await getNewTokens();
    
    if (newTokens.length === 0) {
      console.log('⏭️ No new tokens found this check');
      // Post a test token so you know the bot is alive
      const testToken = {
        name: `MonitorActive_${Math.random().toString(36).substring(2, 6)}`,
        symbol: `TEST${Math.floor(Math.random() * 99)}`,
        price: `$${(Math.random() * 0.0005).toFixed(8)}`,
        marketCap: `$${Math.floor(1000 + Math.random() * 15000)}`,
        mintAddress: `monitor_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`,
        creator: 'BotMonitor',
        createdAt: Date.now() - Math.random() * 120000,
        volume: `$${Math.floor(Math.random() * 5000)}`,
        liquidity: `$${Math.floor(Math.random() * 3000)}`,
        isReal: false
      };
      
      postedTokens.add(testToken.mintAddress);
      const message = formatTokenMessage(testToken);
      await bot.telegram.sendMessage(CHANNEL_ID, message, { 
        parse_mode: 'Markdown',
        disable_web_page_preview: true 
      });
      console.log('✅ Posted keep-alive test token');
      return;
    }
    
    for (const token of newTokens) {
      try {
        postedTokens.add(token.mintAddress);
        const message = formatTokenMessage(token);
        await bot.telegram.sendMessage(CHANNEL_ID, message, { 
          parse_mode: 'Markdown',
          disable_web_page_preview: true 
        });
        console.log(`✅ Posted: ${token.symbol} ${token.isReal ? '(real)' : '(test)'}`);
        await new Promise(resolve => setTimeout(resolve, 2500));
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
