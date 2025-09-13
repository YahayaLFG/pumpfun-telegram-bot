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
    
    // Try multiple API endpoints
    const apiEndpoints = [
      'https://api.dexscreener.com/latest/dex/pairs/solana?limit=20',
      'https://api.pump.fun/coins',
      'https://pumpapi.fun/api/tokens'
    ];
    
    let tokens = [];
    
    for (const endpoint of apiEndpoints) {
      try {
        const response = await fetch(endpoint);
        if (!response.ok) continue;
        
        const data = await response.json();
        let newTokens = [];
        
        // Handle different API response formats
        if (endpoint.includes('dexscreener')) {
          // DexScreener format
          if (data && Array.isArray(data.pairs)) {
            newTokens = data.pairs.slice(0, 15).map(pair => ({
              name: pair.baseToken?.name || 'Unknown',
              symbol: pair.baseToken?.symbol || 'UNKNOWN',
              price: pair.priceUsd || '0.00',
              marketCap: pair.marketCap || '0',
              mintAddress: pair.baseToken?.address || Math.random().toString(),
              creator: 'Unknown',
              createdAt: pair.pairCreatedAt || currentTime,
              volume: pair.volume?.h24 || '0'
            }));
          }
        } else {
          // Pump.fun format
          if (Array.isArray(data)) {
            newTokens = data.slice(0, 15);
          } else if (data && Array.isArray(data.tokens)) {
            newTokens = data.tokens.slice(0, 15);
          } else if (data && Array.isArray(data.data)) {
            newTokens = data.data.slice(0, 15);
          }
        }
        
        // Filter for tokens created since last check
        const freshTokens = newTokens.filter(token => {
          const createdTime = new Date(token.createdAt || currentTime).getTime();
          return createdTime > lastCheckTime && !postedTokens.has(token.mintAddress);
        });
        
        tokens = tokens.concat(freshTokens);
        
      } catch (error) {
        console.log(`Failed to fetch from ${endpoint}:`, error.message);
        continue;
      }
    }
    
    // Update last check time
    lastCheckTime = currentTime;
    
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

Token: ${token.name || 'Unknown'} (${token.symbol || 'N/A'})
Price: $${token.price || '0.00'}
Market Cap: $${token.marketCap || '0'}
Volume: $${token.volume || '0'}

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
    
    console.log(`Found ${newTokens.length} new tokens`);
    
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
