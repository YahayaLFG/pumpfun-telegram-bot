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
    
    // Try multiple API endpoints as Pump.fun sometimes changes them
    const apiEndpoints = [
      'https://api.pump.fun/tokens',
      'https://pumpapi.fun/api/tokens',
      'https://pump.fun/api/tokens'
    ];
    
    let tokens = [];
    let lastError = null;
    
    // Try each endpoint until one works
    for (const endpoint of apiEndpoints) {
      try {
        const response = await fetch(endpoint);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const data = await response.json();
        
        // Handle different response formats
        if (Array.isArray(data)) {
          tokens = data;
        } else if (data && Array.isArray(data.tokens)) {
          tokens = data.tokens;
        } else if (data && data.data && Array.isArray(data.data)) {
          tokens = data.data;
        } else {
          throw new Error('Unexpected API response format');
        }
        
        console.log(`Successfully fetched ${tokens.length} tokens from ${endpoint}`);
        break; // Exit loop if successful
      } catch (error) {
        lastError = error;
        console.log(`Failed to fetch from ${endpoint}: ${error.message}`);
        continue; // Try next endpoint
      }
    }
    
    if (tokens.length === 0 && lastError) {
      throw lastError;
    }
    
    // Filter for very new tokens (created in the last 2 minutes)
    const newTokens = tokens.filter(token => {
      if (!token || !token.mintAddress) return false;
      
      const createdTime = new Date(token.createdAt || token.timestamp || Date.now()).getTime();
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
  const timestamp = token.createdAt || token.timestamp || Date.now();
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
