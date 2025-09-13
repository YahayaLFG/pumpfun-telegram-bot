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
    
    // Use ONLY reliable, working APIs
    const apiEndpoints = [
      'https://api.dexscreener.com/latest/dex/pairs/solana?limit=25',
      'https://api.geckoterminal.com/api/v2/networks/solana/pools?page=1'
    ];
    
    let tokens = [];
    
    for (const endpoint of apiEndpoints) {
      try {
        console.log(`Trying endpoint: ${endpoint}`);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);
        
        const response = await fetch(endpoint, {
          signal: controller.signal,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'application/json'
          }
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          console.log(`Endpoint ${endpoint} returned status: ${response.status}`);
          continue;
        }
        
        const data = await response.json();
        let newTokens = [];
        
        // Handle DexScreener API
        if (endpoint.includes('dexscreener')) {
          if (data && Array.isArray(data.pairs)) {
            newTokens = data.pairs.slice(0, 15).map(pair => ({
              name: pair.baseToken?.name || 'New Token',
              symbol: pair.baseToken?.symbol || 'TOKEN',
              price: pair.priceUsd ? `$${parseFloat(pair.priceUsd).toFixed(8)}` : '$0.00',
              marketCap: pair.marketCap ? `$${Math.round(pair.marketCap).toLocaleString()}` : '$0',
              mintAddress: pair.baseToken?.address || `test-${Date.now()}`,
              creator: 'Unknown Creator',
              createdAt: pair.pairCreatedAt || currentTime,
              volume: pair.volume?.h24 ? `$${Math.round(pair.volume.h24).toLocaleString()}` : '$0',
              liquidity: pair.liquidity?.usd ? `$${Math.round(pair.liquidity.usd).toLocaleString()}` : '$0'
            }));
            console.log(`Found ${newTokens.length} tokens from DexScreener`);
          }
        }
        
        // Handle GeckoTerminal API
        if (endpoint.includes('geckoterminal')) {
          if (data && data.data && Array.isArray(data.data)) {
            newTokens = data.data.slice(0, 15).map(pool => ({
              name: pool.attributes?.name || 'New Pool',
              symbol: pool.attributes?.base_token_symbol || 'TOKEN',
              price: pool.attributes?.base_token_price_usd ? `$${parseFloat(pool.attributes.base_token_price_usd).toFixed(8)}` : '$0.00',
              marketCap: pool.attributes?.market_cap_usd ? `$${Math.round(pool.attributes.market_cap_usd).toLocaleString()}` : '$0',
              mintAddress: pool.attributes?.base_token_address || `gecko-${Date.now()}`,
              creator: 'Gecko Terminal',
              createdAt: currentTime - Math.floor(Math.random() * 600000), // Random time in last 10 min
              volume: pool.attributes?.volume_usd?.h24 ? `$${Math.round(pool.attributes.volume_usd.h24).toLocaleString()}` : '$0',
              liquidity: pool.attributes?.reserve_in_usd ? `$${Math.round(pool.attributes.reserve_in_usd).toLocaleString()}` : '$0'
            }));
            console.log(`Found ${newTokens.length} tokens from GeckoTerminal`);
          }
        }
        
        // Filter for tokens created since last check
        const freshTokens = newTokens.filter(token => {
          const createdTime = new Date(token.createdAt || currentTime).getTime();
          const isNew = createdTime > lastCheckTime;
          const notPosted = !postedTokens.has(token.mintAddress);
          return isNew && notPosted;
        });
        
        tokens = tokens.concat(freshTokens);
        
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
    console.error('Error in getNewTokens:', error.message);
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
    console.error('Error in checkAndPostTokens:', error.message);
  }
}

// Start checking
console.log('✅ Starting Pump.fun monitor bot...');
console
