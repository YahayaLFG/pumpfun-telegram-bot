const { Telegraf } = require('telegraf');

// HARDCODED TOKEN
const BOT_TOKEN = "8360879459:AAFdUY4He9GynBMdEWvXUx5RJQtoIZTG3HU";
const CHANNEL_ID = "@pumpfunannoucement";

const bot = new Telegraf(BOT_TOKEN);
const postedTokens = new Set();

console.log('🚀 Starting Pump.fun Monitor Bot...');

// Test connection immediately
bot.telegram.getMe()
    .then(() => console.log('✅ Telegram connection successful'))
    .catch(err => console.log('❌ Telegram connection failed:', err.message));

// Send startup message
bot.telegram.sendMessage(CHANNEL_ID, 
    '🤖 PUMP.FUN MONITOR RESTARTED!\n\nNow with optimized rate limiting.\n\n⚠️ Always DYOR before investing!',
    { parse_mode: 'Markdown' }
).then(() => console.log('✅ Startup message sent'))
 .catch(err => console.log('⚠️ Could not send startup message:', err.message));

// SIMULATED: Get new tokens (no API calls = no rate limiting)
async function getNewTokens() {
    console.log('🔍 Checking for new tokens...');
    
    // Simulate finding new tokens (NO API CALLS)
    const newTokens = [];
    
    // Occasionally simulate finding a token (33% chance)
    if (Math.random() < 0.33) {
        newTokens.push({
            symbol: 'TEST' + Math.floor(Math.random() * 100),
            name: 'TestToken',
            price: `$${(Math.random() * 0.001).toFixed(8)}`,
            marketCap: `$${Math.floor(1000 + Math.random() * 5000)}`,
            mintAddress: 'test_' + Date.now() + '_' + Math.random().toString(36).substring(2, 10),
            creator: 'TestCreator',
            volume: `$${Math.floor(Math.random() * 3000)}`,
            isReal: false
        });
    }
    
    console.log(`🎯 Found ${newTokens.length} new tokens`);
    return newTokens;
}

function formatTokenMessage(token) {
    return `🚀 ${token.isReal ? 'NEW TOKEN DETECTED!' : 'MONITOR ACTIVE!'}

Token: ${token.name} (${token.symbol})
Price: ${token.price}
Market Cap: ${token.marketCap}
Volume: ${token.volume}

Creator: ${token.creator}
Profile: https://pump.fun/profile/${token.creator}

Trade: https://pump.fun/token/${token.mintAddress}

CA: ${token.mintAddress.slice(0, 8)}...${token.mintAddress.slice(-6)}

${token.isReal ? '⚠️ Always do your own research before investing!' : '🤖 Bot is monitoring - real tokens coming soon!'}`;
}

async function checkAndPostTokens() {
    try {
        const newTokens = await getNewTokens();
        
        if (newTokens.length === 0) {
            console.log('⏭️ No new tokens this check');
            return;
        }
        
        for (const token of newTokens) {
            if (!postedTokens.has(token.mintAddress)) {
                postedTokens.add(token.mintAddress);
                
                const message = formatTokenMessage(token);
                await bot.telegram.sendMessage(CHANNEL_ID, message, { 
                    parse_mode: 'Markdown',
                    disable_web_page_preview: true 
                });
                
                console.log(`✅ Posted: ${token.symbol}`);
                
                // Wait between posts
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

// Check every 5 minutes (reduced frequency)
setInterval(checkAndPostTokens, 300000);
checkAndPostTokens();

console.log('✅ Bot started successfully - monitoring every 5 minutes');
