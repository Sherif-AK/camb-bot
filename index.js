const { Client, GatewayIntentBits } = require('discord.js');
const fs = require('fs');
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

// IDs for your channels
const CAMP_LOG_CHANNEL_ID = '1410252298650783744';
const UPDATE_CHANNEL_ID = '1411305143118336120';

// Data storage
let membersData = {};

// load data from file if exists
const DATA_FILE = './membersData.json';
if (fs.existsSync(DATA_FILE)) {
    membersData = JSON.parse(fs.readFileSync(DATA_FILE));
}

// Helper function to parse message
function parseMessage(message) {
    try {
        const content = message.content;

        // Get discord username
        const discordMatch = content.match(/Discord: @([^\s]+)/);
        if (!discordMatch) return null;
        const username = discordMatch[1];

        if (!membersData[username]) {
            membersData[username] = { materials: 0, withdrawn: 0, delivery: 0 };
        }

        // Materials
        const matMatch = content.match(/Materials added: ([\d.]+)/);
        if (matMatch) {
            membersData[username].materials += parseFloat(matMatch[1]);
        }

        // Withdraw
        const withdrawMatch = content.match(/Withdrew from clan ledger, \$([\d.]+)/);
        if (withdrawMatch) {
            membersData[username].withdrawn += parseFloat(withdrawMatch[1]);
        }

        // Delivery / Sale
        const deliveryMatch = content.match(/Made a Sale Of [\d]+ Of Stock For \$([\d.]+)/);
        if (deliveryMatch) {
            membersData[username].delivery += parseFloat(deliveryMatch[1]);
        }

        // Save after update
        fs.writeFileSync(DATA_FILE, JSON.stringify(membersData, null, 2));

        return true;
    } catch (err) {
        console.error('Error parsing message:', err);
        return null;
    }
}

// Function to send update
async function sendUpdate(channel) {
    let updateMessage = '**Camp Update:**\n\n';
    for (const user in membersData) {
        const data = membersData[user];
        updateMessage += `@${user}\n  Materials: ${data.materials}\n  Withdrawn: $${data.withdrawn.toFixed(2)}\n  Delivery: $${data.delivery.toFixed(2)}\n\n`;
    }
    if (updateMessage.length > 2000) {
        updateMessage = updateMessage.slice(0, 1997) + '...';
    }
    await channel.send(updateMessage);
}

// Real-time listener
client.on('messageCreate', async message => {
    // Skip bots
    if (message.author.bot) return;

    // Reset command
    if (message.content.toLowerCase() === '!reset') {
        membersData = {};
        fs.writeFileSync(DATA_FILE, JSON.stringify(membersData, null, 2));
        return message.channel.send('All data has been reset!');
    }

    // Only monitor camp log channel
    if (message.channel.id !== CAMP_LOG_CHANNEL_ID) return;

    const parsed = parseMessage(message);
    if (!parsed) return;

    const updateChannel = await client.channels.fetch(UPDATE_CHANNEL_ID);
    if (updateChannel) sendUpdate(updateChannel);
});

client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}`);
});

client.login(process.env.DISCORD_TOKEN);

