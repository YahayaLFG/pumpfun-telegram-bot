const { Telegraf } = require('telegraf');

// HARDCODED TOKEN - Replace with your actual token
const BOT_TOKEN = "8360879459:AAFdUY4He9GynBMdEWvXUx5RJQtoIZTG3HU";
const CHANNEL_ID = "@pumpfunannoucement";

const bot = new Telegraf(BOT_TOKEN);

console.log('✅ Bot starting...');

// Send a test message every 2 minutes
setInterval(async () => {
  try {
    const testMessage = `🤖 BOT IS WORKING! 
    
Time: ${new Date().toLocaleTimeString()}
Status: ✅ Operational
Monitoring: Active

This is a test message to confirm your bot is running perfectly!`;

    await bot.telegram.sendMessage(CHANNEL_ID, testMessage);
    console.log('✅ Test message sent successfully!');
  } catch (error) {
    console.error('❌ Error sending test message:', error.message);
  }
}, 120000); // 2 minutes

// Send immediate test
bot.telegram.sendMessage(CHANNEL_ID, '🚀 Bot initialized successfully! Ready to monitor Pump.fun.')
  .then(() => console.log('✅ Initial test message sent!'))
  .catch(err => console.error('❌ Initial test failed:', err.message));

console.log('✅ Bot setup complete - waiting for first test message...');
