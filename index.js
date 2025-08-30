const { Client, GatewayIntentBits } = require('discord.js');
const fs = require('fs');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// ===== CONFIG =====
const CAMP_LOG_CHANNEL_ID = '1410252298650783744';
const UPDATE_CHANNEL_ID = '1411305143118336120';
const BOT_TOKEN = 'YOUR_BOT_TOKEN';
const DATA_FILE = './membersData.json';
// ==================

let membersData = {};
if (fs.existsSync(DATA_FILE)) {
    try {
        membersData = JSON.parse(fs.readFileSync(DATA_FILE));
    } catch (err) {
        console.error('Error reading data file:', err);
        membersData = {};
    }
}

function parseMessage(message) {
    try {
        const content = message.content;
        if (!content) return null;

        const discordMatch = content.match(/Discord: @([^\s]+)/);
        if (!discordMatch) return null;
        const username = discordMatch[1];

        if (!membersData[username]) {
            membersData[username] = { materials: 0, withdrawn: 0, delivery: 0 };
        }

        const matMatch = content.match(/Materials added: ([\d.]+)/);
        if (matMatch) membersData[username].materials += parseFloat(matMatch[1]);

        const withdrawMatch = content.match(/Withdrew from clan ledger, \$([\d.]+)/);
        if (withdrawMatch) membersData[username].withdrawn += parseFloat(withdrawMatch[1]);

        const deliveryMatch = content.match(/Made a Sale Of [\d]+ Of Stock For \$([\d.]+)/);
        if (deliveryMatch) membersData[username].delivery += parseFloat(deliveryMatch[1]);

        fs.writeFileSync(DATA_FILE, JSON.stringify(membersData, null, 2));

        return true;
    } catch (err) {
        console.error('Error parsing message:', err);
        return null;
    }
}

async function sendUpdate(channel) {
    if (!channel) return;

    let updateMessage = '**Camp Update:**\n\n';
    for (const user in membersData) {
        const data = membersData[user];
        updateMessage += `@${user}\n  Materials: ${data.materials}\n  Withdrawn: $${data.withdrawn.toFixed(2)}\n  Delivery: $${data.delivery.toFixed(2)}\n\n`;
    }

    if (updateMessage.length > 2000) updateMessage = updateMessage.slice(0, 1997) + '...';

    try {
        await channel.send(updateMessage);
    } catch (err) {
        console.error('Failed to send update:', err);
    }
}

client.on('messageCreate', async message => {
    // Ignore bot's own messages
    if (message.author?.id === client.user.id) return;

    // Reset command
    if (message.content.toLowerCase() === '!reset') {
        membersData = {};
        fs.writeFileSync(DATA_FILE, JSON.stringify(membersData, null, 2));
        const updateChannel = await client.channels.fetch(UPDATE_CHANNEL_ID).catch(() => null);
        if (updateChannel) updateChannel.send('All data has been reset!');
        return;
    }

    // Only process camp log channel
    if (message.channel.id !== CAMP_LOG_CHANNEL_ID) return;

    // Handle both webhook and user messages
    const parsed = parseMessage(message);
    if (!parsed) return;

    const updateChannel = await client.channels.fetch(UPDATE_CHANNEL_ID).catch(() => null);
    if (updateChannel) sendUpdate(updateChannel);
});

client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}`);
});

client.login(process.env.DISCORD_TOKEN);
