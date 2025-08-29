require("dotenv").config();
const { Client, GatewayIntentBits } = require("discord.js");
const fs = require("fs");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// Channel ID where the webhook posts logs
const WEBHOOK_CHANNEL_ID = "1410252298650783744";

// Load existing data
let players = {};
if (fs.existsSync("players.json")) {
  try {
    players = JSON.parse(fs.readFileSync("players.json", "utf8"));
  } catch {
    players = {};
  }
}

function getPlayerName(text) {
  // Prefer the "Discord: @Name 123456..." line
  const m = text.match(/Discord:\s*@(.+?)\s+\d{5,}/i);
  if (m) return m[1].trim();

  // Fallback: first line (if it isn't the clan header)
  const first = text.split("\n")[0].trim();
  if (!/^Clan Name:/i.test(first)) return first;

  return "Unknown";
}

function parseMoney(text) {
  // Matches $1,234.56 or $400 or $400.0
  const m = text.match(/\$([\d,]+(?:\.\d+)?)/);
  return m ? parseFloat(m[1].replace(/,/g, "")) : 0;
}

client.on("messageCreate", (message) => {
  // Only handle the webhook channel
  if (message.channel.id !== WEBHOOK_CHANNEL_ID) return;

  // Ignore other bots, but ALLOW webhook messages
  if (message.author.bot && !message.webhookId) return;

  const text = message.content;
  const name = getPlayerName(text);
  if (!name) return;

  if (!players[name]) {
    players[name] = {
      withdrawals: 0,
      deposits: 0,
      materials: 0,
      deliveryMoney: 0,
      supplyMission: 0
    };
  }

  // Materials donated
  const matMatch = text.match(/Materials added:\s*([\d.]+)/i);
  if (matMatch) {
    players[name].materials += parseFloat(matMatch[1]);
  }

  // Withdrawals
  if (/withdrew/i.test(text) || /withdrawal/i.test(text)) {
    const amt = parseMoney(text);
    if (amt) players[name].withdrawals += amt;
  }

  // Deposits
  if (/deposited/i.test(text) || /deposit/i.test(text)) {
    const amt = parseMoney(text);
    if (amt) players[name].deposits += amt;
  }

  // Delivery money
  if (/made a sale/i.test(text) || /sale of/i.test(text)) {
    const amt = parseMoney(text);
    if (amt) players[name].deliveryMoney += amt;
  }

  // Supply Missions
  if (/supply mission/i.test(text)) {
    players[name].supplyMission += 1;
  }

  // Save data
  fs.writeFileSync("players.json", JSON.stringify(players, null, 2));
});

// Command: show summary
client.on("messageCreate", (message) => {
  if (message.content === "!summary") {
    const lines = Object.entries(players).map(([player, d]) =>
      `${player}:\n` +
      `- Withdrawals: $${d.withdrawals.toFixed(2)}\n` +
      `- Deposits: $${d.deposits.toFixed(2)}\n` +
      `- Materials: ${d.materials.toFixed(2)}\n` +
      `- Delivery Money: $${d.deliveryMoney.toFixed(2)}\n` +
      `- Supply Missions: ${d.supplyMission}`
    );
    message.channel.send(lines.join("\n\n") || "No data yet!");
  }
});

client.once("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

// Use token from .env
client.login(process.env.DISCORD_TOKEN);
