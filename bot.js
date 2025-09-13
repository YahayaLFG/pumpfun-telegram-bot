const { Telegraf } = require('telegraf');
const fetch = require('node-fetch');

// HARDCODED TOKEN - Replace with your actual token
const BOT_TOKEN = "8360879459:AAFdUY4He9GynBMdEWvXUx5RJQtoIZTG3HU";
const CHANNEL_ID = "@pumpfunannoucement"; // YOUR CHANNEL
const CHECK_INTERVAL = 30000;

const bot = new Telegraf(BOT_TOKEN);

// Track already posted tokens to avoid duplicates
const postedTokens = new Set();

// Store the last check time to only get new tokens
let lastCheckTime = Date.now();

async function getNewTokens() {
  try {
    console.log('Checking for new tokens...');
    
    const currentTime = Date.now();
    
    // Try multiple API endpoints (removed the problematic one)
    const apiEndpoints = [
      'https://api.dexscreener.com/latest/dex/pairs/solana?limit=20',
      'https://api.pump.fun/coins',
      'https://api.rug.check/coins'
    ];
    
    let tokens = [];
    
    for (const endpoint of apiEndpoints) {
      try {
        // Skip SSL verification for problematic endpoints
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        const response = await fetch(endpoint, {
          signal: controller.signal,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          console.log(`Endpoint ${endpoint} returned status: ${response.status}`);
          continue;
        }
        
        const data = await response.json();
        let newTokens = [];
        
        // Handle different API response formats
        if (endpoint.includes('dexscreener')) {
          // DexScreener format - most reliable
          if (data && Array.isArray(data.pairs)) {
            newTokens = data.pairs.slice(0, 10).map(pair => ({
              name: pair.baseToken?.name || 'Unknown Token',
              symbol: pair.baseToken?.symbol || 'UNKNOWN',
              price: pair.priceUsd ? `$${parseFloat(pair.priceUsd).toFixed(8)}` : '$0.00',
              marketCap: pair.marketCap ? `$${Math.round(pair.marketCap).toLocaleString()}` : '$0',
              mintAddress: pair.baseToken?.address || `test-${Math.random().toString(36).substring(7)}`,
              creator: pair.info?.creator || 'Unknown Creator',
              createdAt: pair.pairCreatedAt || currentTime,
              volume: pair.volume?.h24 ? `$${Math.round(pair.volume.h24).toLocaleString()}` : '$0'
            }));
          }
        } else if (endpoint.includes('pump.fun')) {
          // Pump.fun format
          if (Array.isArray(data)) {
            newTokens = data.slice(0, 10);
          } else if (data && Array.isArray(data.coins)) {
            newTokens = data.coins.slice(0, 10);
          }
        } else if (endpoint.includes('rug.check')) {
          // Rug check API format
          if (Array.isArray(data)) {
            newTokens = data.slice(0, 10);
          }
        }
        
        if (newTokens.length > 0) {
          console.log(`Found ${newTokens.length} tokens from ${endpoint}`);
          
          // Filter for tokens created since last check
          const freshTokens = newTokens.filter(token => {
            const createdTime = new Date(token.createdAt || currentTime).getTime();
            const isNew = createdTime > lastCheckTime;
            const notPosted = !postedTokens.has(token.mintAddress);
            
            if (isNew && notPosted) {
              console.log(`New token found: ${token.symbol}`);
            }
            
            return isNew && notPosted;
          });
          
          tokens = tokens.concat(freshTokens);
        }
        
      } catch (error) {
        console.log(`Failed to fetch from ${endpoint}:`, error.message);
        continue;
      }
    }
    
    // Update last check time
    lastCheckTime = currentTime;
    
    console.log(`Total new tokens found: ${tokens.length}`);
    return tokens;
    
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

Token: ${token.name || 'Unknown Token'} (${token.symbol || 'N/A'})
Price: ${token.price || '$0.00'}
Market Cap: ${token.marketCap || '$0'}
Volume: ${token.volume || '$0'}

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
    
    console.log(`Processing ${newTokens.length} new tokens`);
    
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
        await new Promise(resolve => setTimeout(resolve, 2500));
        
      } catch (postError) {
        console.error('Error posting token:', postError.message);
      }
    }
  } catch (error) {
    console.error('Error in checkAndPostTokens:', error);
  }
}

// Start checking
console.log('✅ Starting Pump.fun monitor bot...');
console.log(`✅ Monitoring channel: ${CHANNEL_ID}`);
setInterval(checkAndPostTokens, CHECK_INTERVAL);
checkAndPostTokens(); // Initial check

// Handle graceful shutdown
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
