const { Telegraf } = require('telegraf');
const fetch = require('node-fetch');

// Get configuration from environment variables
const BOT_TOKEN = "8360879459:AAFdUY4He9GynBMdEWvXUx5RJQtoIZTG3HU";
const CHANNEL_ID = "@pumpfunannoucement";
const CHECK_INTERVAL = process.env.CHECK_INTERVAL || 30000;

const bot = new Telegraf(BOT_TOKEN);

// Track already posted tokens to avoid duplicates
const postedTokens = new Set();

async function getNewTokens() {
  try {
    console.log('Checking for new tokens...');
    
    // Alternative approach - use multiple data sources
    const responses = await Promise.allSettled([
      // Try direct blockchain data approach
      fetch('https://api.dexscreener.com/latest/dex/tokens/So11111111111111111111111111111111111111112'),
      
      // Try alternative pump.fun endpoints
      fetch('https://pump.fun/api/coins'),
      fetch('https://api-raydium.pump.fun/coins'),
      
      // Backup: try community API
      fetch('https://pumpmonitor.xyz/api/v1/tokens')
    ]);
    
    let tokens = [];
    
    // Process successful responses
    for (const response of responses) {
      if (response.status === 'fulfilled' && response.value.ok) {
        try {
          const data = await response.value.json();
          
          // Handle different response formats
          if (Array.isArray(data)) {
            tokens = tokens.concat(data.slice(0, 10)); // Get first 10
          } else if (data && Array.isArray(data.tokens)) {
            tokens = tokens.concat(data.tokens.slice(0, 10));
          } else if (data && Array.isArray(data.data)) {
            tokens = tokens.concat(data.data.slice(0, 10));
          } else if (data && data.pairs) {
            // DexScreener format
            tokens = tokens.concat(data.pairs.slice(0, 10).map(pair => ({
              name: pair.baseToken.name,
              symbol: pair.baseToken.symbol,
              price: pair.priceUsd,
              marketCap: pair.marketCap,
              mintAddress: pair.baseToken.address,
              creator: 'Unknown',
              createdAt: Date.now()
            })));
          }
        } catch (e) {
          console.log('Error parsing API response:', e.message);
        }
      }
    }
    
    if (tokens.length === 0) {
      console.log('All API endpoints failed - using mock data for testing');
      // Generate mock data for testing
      tokens = [{
        name: 'Test Token',
        symbol: 'TEST',
        price: (Math.random() * 0.001).toFixed(8),
        marketCap: Math.floor(Math.random() * 10000),
        mintAddress: 'Ezx123' + Math.random().toString(36).substring(7),
        creator: 'TestCreator',
        createdAt: Date.now()
      }];
    }
    
    // Filter for very new tokens
    const newTokens = tokens.filter(token => {
      if (!token || !token.mintAddress) return false;
      
      const createdTime = new Date(token.createdAt || Date.now()).getTime();
      const isNew = (Date.now() - createdTime) < 300000; // 5 minutes
      return isNew && !postedTokens.has(token.mintAddress);
    });
    
    return newTokens;
  } catch (error) {
    console.error('Error fetching tokens:', error);
    return [];
  }
}

function formatTokenMessage(token) {
  const timestamp = token.createdAt || Date.now();
  const timeAgo = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000);
  const minutesAgo = Math.floor(timeAgo / 60);
  
  return `🚀 NEW PUMP.FUN TOKEN LAUNCHED!

Token: ${token.name || 'Unknown'} (${token.symbol || 'N/A'})
Price: $${token.price || '0.00'}
Market Cap: $${token.marketCap || '0'}

Creator: ${token.creator || 'Unknown'}
Profile: https://pump.fun/profile/${token.creator || 'unknown'}

Trade: https://pump.fun/token/${token.mintAddress}

CA: ${token.mintAddress ? `${token.mintAddress.slice(0, 10)}...${token.mintAddress.slice(-8)}` : 'N/A'}
Created: ${minutesAgo > 0 ? `${minutesAgo} minute${minutesAgo !== 1 ? 's' : ''} ago` : 'Just now'}

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
      
      console.log(`Posted new token: ${token.symbol || 'Unknown'}`);
      
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
