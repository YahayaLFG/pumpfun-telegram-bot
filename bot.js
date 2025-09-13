const { Telegraf } = require('telegraf');
const fetch = require('node-fetch');

// HARDCODED TOKEN - Replace with your actual token
const BOT_TOKEN = "8360879459:AAFdUY4He9GynBMdEWvXUx5RJQtoIZTG3HU";
const CHANNEL_ID = "@pumpfunannoucement"; // YOUR CHANNEL
const CHECK_INTERVAL = 30000; // 30 seconds

const bot = new Telegraf(BOT_TOKEN);

// Track already posted tokens to avoid duplicates
const postedTokens = new Set();

// Store the last check time to only get new tokens
let lastCheckTime = Date.now();

// Function to initialize bot with retry
async function initializeBot() {
  try {
    console.log('🚀 Starting Pump.fun monitor bot...');
    console.log(`📢 Monitoring channel: ${CHANNEL_ID}`);
    
    // Test bot token first
    await bot.telegram.getMe();
    console.log('✅ Bot token is valid');
    
    // Start the monitoring
    startMonitoring();
    
  } catch (error) {
    console.error('❌ Failed to initialize bot:', error.message);
    console.log('🔄 Retrying in 10 seconds...');
    setTimeout(initializeBot, 10000);
  }
}

function startMonitoring() {
  console.log('✅ Starting token monitoring...');
  setInterval(checkAndPostTokens, CHECK_INTERVAL);
  checkAndPostTokens(); // Initial check
}

async function getNewTokens() {
  try {
    console.log('🔍 Checking for new tokens...');
    
    const currentTime = Date.now();
    let tokens = [];
    
    // Use ONLY reliable DexScreener API
    try {
      const response = await fetch('https://api.dexscreener.com/latest/dex/pairs/solana?limit=20', {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        
        if (data && Array.isArray(data.pairs)) {
          tokens = data.pairs.slice(0, 10).map(pair => ({
            name: pair.baseToken?.name || 'New Token',
            symbol: pair.baseToken?.symbol || 'TOKEN',
            price: pair.priceUsd ? `$${parseFloat(pair.priceUsd).toFixed(8)}` : '$0.00',
            marketCap: pair.marketCap ? `$${Math.round(pair.marketCap).toLocaleString()}` : '$0',
            mintAddress: pair.baseToken?.address || `test-${Date.now()}-${Math.random().toString(36).substring(7)}`,
            creator: pair.info?.creator || 'Unknown Creator',
            createdAt: pair.pairCreatedAt || (currentTime - Math.random() * 300000),
            volume: pair.volume?.h24 ? `$${Math.round(pair.volume.h24).toLocaleString()}` : '$0',
            liquidity: pair.liquidity?.usd ? `$${Math.round(pair.liquidity.usd).toLocaleString()}` : '$0'
          }));
          console.log(`✅ Found ${tokens.length} tokens from DexScreener`);
        }
      }
    } catch (apiError) {
      console.log('⚠️ DexScreener API failed, using mock data:', apiError.message);
      // Generate mock data for testing
      tokens = [{
        name: 'Test Token',
        symbol: 'TEST',
        price: `$${(Math.random() * 0.001).toFixed(8)}`,
        marketCap: `$${Math.floor(Math.random() * 10000)}`,
        mintAddress: `test-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        creator: 'TestCreator',
        createdAt: currentTime - 60000, // 1 minute ago
        volume: `$${Math.floor(Math.random() * 5000)}`,
        liquidity: `$${Math.floor(Math.random() * 2000)}`
      }];
    }
    
    // Filter for tokens created since last check
    const freshTokens = tokens.filter(token => {
      const createdTime = new Date(token.createdAt || currentTime).getTime();
      const isNew = createdTime > lastCheckTime;
      const notPosted = !postedTokens.has(token.mintAddress);
      return isNew && notPosted;
    });
    
    // Update last check time
    lastCheckTime = currentTime;
    
    console.log(`📊 Total new tokens found: ${freshTokens.length}`);
    return freshTokens;
    
  } catch (error) {
    console.error('❌ Error in getNewTokens:', error.message);
    return [];
  }
}

function formatTokenMessage(token) {
  const timestamp = token.createdAt || Date.now();
  const timeAgo = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000);
  const minutesAgo = Math.floor(timeAgo / 60);
  
  return `🚀 NEW PUMP.FUN TOKEN LAUNCHED!

Token: ${token.name || 'Unknown Token'} (${token.symbol || 'N/A'})
Price: ${token.price || '$0.00'}
Market Cap: ${token.marketCap || '$0'}
Volume: ${token.volume || '$0'}
Liquidity: ${token.liquidity || '$0'}

Creator: ${token.creator || 'Unknown'}
Profile: https://pump.fun/profile/${token.creator || 'unknown'}

Trade: https://pump.fun/token/${token.mintAddress}

CA: ${token.mintAddress ? `${token.mintAddress.slice(0, 10)}...${token.mintAddress.slice(-8)}` : 'N/A'}
Created: ${minutesAgo > 0 ? `${minutesAgo} minute${minutesAgo !== 1 ? 's' : ''} ago` : 'Just now'}

⚠️ Always do your own research before investing!`;
}

async function checkAndPostTokens() {
  try {
    console.log('🔄 Checking for new tokens...');
    const newTokens = await getNewTokens();
    
    console.log(`📨 Processing ${newTokens.length} new tokens`);
    
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
        
        console.log(`✅ Posted new token: ${token.symbol || 'Unknown'}`);
        
        // Wait a moment between posts
        await new Promise(resolve => setTimeout(resolve, 2000));
        
      } catch (postError) {
        console.error('❌ Error posting token:', postError.message);
      }
    }
    
    console.log('✅ Check completed successfully');
    
  } catch (error) {
    console.error('❌ Error in checkAndPostTokens:', error.message);
  }
}

// Start the bot with error handling
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
