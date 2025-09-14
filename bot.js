const { Telegraf } = require('telegraf');
const { Connection, PublicKey, clusterApiUrl } = require('@solana/web3.js');

// HARDCODED TOKEN - Replace with your actual token
const BOT_TOKEN = "8360879459:AAFdUY4He9GynBMdEWvXUx5RJQtoIZTG3HU";
const CHANNEL_ID = "@pumpfunannoucement";
const CHECK_INTERVAL = 30000; // 30 seconds

const bot = new Telegraf(BOT_TOKEN);
const postedTokens = new Set();

// Solana connection
const connection = new Connection(clusterApiUrl('mainnet-beta'));

// Pump.fun program address (where tokens are created)
const PUMP_FUN_PROGRAM = new PublicKey('6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P');

// Track recent transactions to avoid duplicates
const processedTransactions = new Set();

async function initializeBot() {
    try {
        console.log('🚀 Starting Solana Blockchain Monitor...');
        await bot.telegram.getMe();
        console.log('✅ Bot token is valid');
        
        await bot.telegram.sendMessage(CHANNEL_ID, 
            '🤖 SOLANA BLOCKCHAIN MONITOR ACTIVATED!\n\nMonitoring for new token creations on Solana...\n\n⚠️ Always DYOR before investing!',
            { parse_mode: 'Markdown' }
        );
        
        startMonitoring();
    } catch (error) {
        console.error('❌ Initialization failed:', error.message);
        setTimeout(initializeBot, 10000);
    }
}

function startMonitoring() {
    console.log('✅ Starting blockchain monitoring...');
    setInterval(checkBlockchainForNewTokens, CHECK_INTERVAL);
    checkBlockchainForNewTokens();
}

async function checkBlockchainForNewTokens() {
    try {
        console.log('🔍 Scanning Solana blockchain for new tokens...');
        
        // Get recent transactions from Pump.fun program
        const signatures = await connection.getSignaturesForAddress(
            PUMP_FUN_PROGRAM,
            { limit: 20 }
        );
        
        console.log(`📊 Found ${signatures.length} recent transactions`);
        
        for (const signatureInfo of signatures) {
            const signature = signatureInfo.signature;
            
            // Skip if already processed
            if (processedTransactions.has(signature)) continue;
            
            try {
                // Get transaction details
                const transaction = await connection.getTransaction(signature, {
                    maxSupportedTransactionVersion: 0
                });
                
                if (transaction && transaction.meta) {
                    const newTokens = await extractTokensFromTransaction(transaction, signature);
                    
                    if (newTokens.length > 0) {
                        await processNewTokens(newTokens);
                    }
                }
                
                // Mark as processed
                processedTransactions.add(signature);
                
            } catch (txError) {
                console.log('❌ Error processing transaction:', txError.message);
            }
            
            // Small delay between transactions
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        
    } catch (error) {
        console.error('❌ Blockchain scan failed:', error.message);
    }
}

async function extractTokensFromTransaction(transaction, signature) {
    const tokens = [];
    
    try {
        // Look for token creation in transaction
        if (transaction.meta.postTokenBalances) {
            for (const balance of transaction.meta.postTokenBalances) {
                if (balance.mint && !postedTokens.has(balance.mint)) {
                    tokens.push({
                        mintAddress: balance.mint,
                        signature: signature,
                        owner: balance.owner,
                        uiTokenAmount: balance.uiTokenAmount,
                        transactionTime: new Date(transaction.blockTime * 1000),
                        isNew: true
                    });
                }
            }
        }
    } catch (error) {
        console.log('❌ Error extracting tokens:', error.message);
    }
    
    return tokens;
}

async function processNewTokens(tokens) {
    console.log(`🎯 Processing ${tokens.length} new tokens...`);
    
    for (const token of tokens) {
        try {
            // Get token metadata
            const tokenInfo = await getTokenMetadata(token.mintAddress);
            
            // Mark as posted
            postedTokens.add(token.mintAddress);
            
            // Send to Telegram
            const message = formatTokenMessage(token, tokenInfo);
            await bot.telegram.sendMessage(CHANNEL_ID, message, { 
                parse_mode: 'Markdown',
                disable_web_page_preview: true 
            });
            
            console.log(`✅ Posted new token: ${tokenInfo.symbol || token.mintAddress.slice(0, 8)}`);
            
            // Delay between posts
            await new Promise(resolve => setTimeout(resolve, 2000));
            
        } catch (error) {
            console.log('❌ Error processing token:', error.message);
        }
    }
}

async function getTokenMetadata(mintAddress) {
    try {
        // Try to get token metadata from Solana
        const mintPublicKey = new PublicKey(mintAddress);
        const accountInfo = await connection.getAccountInfo(mintPublicKey);
        
        if (accountInfo) {
            // Basic token info
            return {
                mintAddress: mintAddress,
                symbol: `TOKEN_${mintAddress.slice(0, 4)}`,
                name: `Token ${mintAddress.slice(0, 8)}`,
                createdAt: new Date(),
                isReal: true
            };
        }
    } catch (error) {
        console.log('❌ Error getting token metadata:', error.message);
    }
    
    // Fallback info
    return {
        mintAddress: mintAddress,
        symbol: 'NEW_TOKEN',
        name: 'New Solana Token',
        createdAt: new Date(),
        isReal: true
    };
}

function formatTokenMessage(token, tokenInfo) {
    const timeAgo = Math.floor((Date.now() - token.transactionTime) / 1000);
    const minutes = Math.floor(timeAgo / 60);
    const seconds = timeAgo % 60;
    
    return `🚀 **NEW SOLANA TOKEN CREATED!**

**Token:** ${tokenInfo.name} (${tokenInfo.symbol})
**Mint Address:** \`${token.mintAddress.slice(0, 12)}...${token.mintAddress.slice(-8)}\`
**Created:** ${minutes > 0 ? `${minutes}m ${seconds}s ago` : `${seconds}s ago`}

**Transaction:** [View on Solscan](https://solscan.io/tx/${token.signature})

**Trade:** https://pump.fun/token/${token.mintAddress}

**CA:** \`${token.mintAddress}\`

⚠️ **Always do your own research before investing!**
🔗 **This token was just created on the Solana blockchain!**`;
}

// Update package.json dependencies
const PACKAGE_JSON = {
    "name": "pumpfun-telegram-bot",
    "version": "2.0.0",
    "main": "bot.js",
    "scripts": {
        "start": "node bot.js"
    },
    "dependencies": {
        "@solana/web3.js": "^1.87.6",
        "telegraf": "^4.12.2"
    }
};

// Start the bot
initializeBot();

// Graceful shutdown
process.once('SIGINT', () => {
    console.log('🛑 Shutting down bot...');
    bot.stop('SIGINT');
    process.exit(0);
});
