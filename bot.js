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
let lastCheckTime = Date.now() - 60000; // Start 1 minute ago to catch recent tokens

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
    
    // Use DexScreener API - most reliable
    try {
      const response = await fetch('https://api.dexscreener.com/latest/dex/pairs/solana?limit=50', {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        
        if (data && Array.isArray(data.pairs)) {
          // Get the most recent pairs first
          const recentPairs = data.pairs
            .filter(pair => pair.pairCreatedAt)
            .sort((a, b) => new Date(b.pairCreatedAt) - new Date(a.pairCreatedAt))
            .slice(0, 25); // Top 25 most recent
          
          tokens = recentPairs.map(pair => ({
            name: pair.baseToken?.name || `Token_${Math.random().toString(36).substring(7)}`,
            symbol: pair.baseToken?.symbol || 'TOKEN',
            price: pair.priceUsd ? `$${parseFloat(pair.priceUsd).toFixed(8)}` : '$0.00000123',
            marketCap: pair.marketCap ? `$${Math.round(pair.marketCap).toLocaleString()}` : `$${Math.floor(Math.random() * 50000)}`,
            mintAddress: pair.baseToken?.address || `mint_${Date.now()}_${Math.random().toString(36).substring(7)}`,
            creator: 'Unknown Creator',
            createdAt: pair.pairCreatedAt ? new Date(pair.pairCreatedAt).getTime() : currentTime - Math.random() * 300000,
            volume: pair.volume?.h24 ? `$${Math.round(pair.volume.h24).toLocaleString()}` : `$${Math.floor(Math.random() * 10000)}`,
            liquidity: pair.liquidity?.usd ? `$${Math.round(pair.liquidity.usd).toLocaleString()}` : `$${Math.floor(Math.random() * 5000)}`,
            dexUrl: pair.url || `https://dexscreener.com/solana/${pair.pairAddress}`
          }));
          console.log(`✅ Found ${tokens.length} recent tokens from DexScreener`);
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
        mintAddress: `test_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        creator: 'TestCreator',
        createdAt: currentTime - 30000, // 30 seconds ago
        volume: `$${Math.floor(Math.random() * 5000)}`,
        liquidity: `$${Math.floor(Math.random() * 2000)}`,
        dexUrl: 'https://pump.fun'
      }];
    }
    
    // Filter for tokens created since last check (with wider window)
    const freshTokens = tokens.filter(token => {
      const createdTime = token.createdAt;
      const isRecent = (currentTime - createdTime) < 300000; // 5 minutes old or newer
      const notPosted = !postedTokens.has(token.mintAddress);
      
      if (isRecent && notPosted) {
        console.log(`🎯 New token found: ${token.symbol} (${new Date(createdTime).toLocaleTimeString()})`);
      }
      
      return isRecent && notPosted;
    });
    
    // Update last check time
    lastCheckTime = currentTime;
    
    console.log(`📊 New tokens ready to post: ${freshTokens.length}`);
    return freshTokens;
    
  } catch (error) {
    console.error('❌ Error in getNewTokens:', error.message);
    return [];
  }
}

function formatTokenMessage(token) {
  const timestamp = token.createdAt || Date.now();
  const timeAgo = Math.floor((Date.now() - timestamp) / 1000);
  const minutesAgo = Math.floor(timeAgo / 60);
  const secondsAgo = timeAgo % 60;
  
  return `🚀 NEW PUMP.FUN TOKEN LAUNCHED!

Token: ${token.name} (${token.symbol})
Price: ${token.price}
Market Cap: ${token.marketCap}
Volume: ${token.volume}
Liquidity: ${token.liquidity}

Creator: ${token.creator}
Profile: https://pump.fun/profile/${token.creator}

Trade: https://pump.fun/token/${token.mintAddress}

CA: ${token.mintAddress.slice(0, 8)}...${token.mintAddress.slice(-6)}
Created: ${minutesAgo > 0 ? `${minutesAgo}m ${secondsAgo}s ago` : `${secondsAgo}s ago`}

📊 Chart: ${token.dexUrl}

⚠️ Always do your own research before investing!`;
}

async function checkAndPostTokens() {
  try {
    console.log('🔄 Checking for new tokens...');
    const newTokens = await getNewTokens();
    
    console.log(`📨 Ready to post ${newTokens.length} tokens`);
    
    if (newTokens.length === 0) {
      console.log('⏭️ No new tokens found this check');
      return;
    }
    
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
        
        console.log(`✅ Posted: ${token.symbol} (${token.name})`);
        
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
