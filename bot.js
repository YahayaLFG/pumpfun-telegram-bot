const { Telegraf } = require('telegraf');
const { TwitterApi } = require('twitter-api-v2');

// HARDCODED TOKEN - Replace with your actual token
const BOT_TOKEN = "8360879459:AAFdUY4He9GynBMdEWvXUx5RJQtoIZTG3HU";
const CHANNEL_ID = "@pumpfunannoucement";

const bot = new Telegraf(BOT_TOKEN);
const postedTweets = new Set();

// Twitter Client (using public access - no auth needed)
const twitterClient = new TwitterApi("AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA"); // This is Twitter's public token

async function monitorTwitter() {
  console.log('🐦 Monitoring Twitter for Pump.fun launches...');
  
  try {
    // Monitor key Pump.fun related accounts
    const accounts = [
      'pumpfun', 
      'pumpdotfun',
      'pumpfunbot',
      'pumpfunwatch'
    ];
    
    for (const username of accounts) {
      try {
        const user = await twitterClient.v2.userByUsername(username);
        const tweets = await twitterClient.v2.userTimeline(user.data.id, {
          max_results: 10,
          'tweet.fields': ['created_at', 'text']
        });
        
        for (const tweet of tweets.data.data) {
          if (isPumpFunLaunch(tweet.text) && !postedTweets.has(tweet.id)) {
            await postToTelegram(tweet);
            postedTweets.add(tweet.id);
          }
        }
      } catch (error) {
        console.log(`⚠️ Could not fetch from @${username}:`, error.message);
      }
    }
  } catch (error) {
    console.log('Twitter monitoring error:', error.message);
  }
}

function isPumpFunLaunch(text) {
  const patterns = [
    /new.*token.*launch/i,
    /pump\.fun.*token/i,
    /ca:.*[0-9a-zA-Z]{10,}/i,
    /contract:.*[0-9a-zA-Z]{10,}/i,
    /https:\/\/pump\.fun\/token\//i
  ];
  
  return patterns.some(pattern => pattern.test(text));
}

async function postToTelegram(tweet) {
  const tweetUrl = `https://twitter.com/user/status/${tweet.id}`;
  
  const message = `🚀 PUMP.FUN TOKEN DETECTED!

📢 From Twitter: ${tweetUrl}

${tweet.text}

⚠️ Always DYOR before investing!
🔗 Check: https://pump.fun`;

  await bot.telegram.sendMessage(CHANNEL_ID, message, {
    parse_mode: 'Markdown',
    disable_web_page_preview: false
  });
  
  console.log('✅ Posted Twitter alert to Telegram');
}

// Start monitoring
console.log('🤖 Starting Twitter monitor bot...');
setInterval(monitorTwitter, 60000); // Check every minute
monitorTwitter(); // Initial check
