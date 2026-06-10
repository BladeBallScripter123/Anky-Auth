const { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes } = require('discord.js');
const axios = require('axios');

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID; // your app ID
const GUILD_ID = process.env.GUILD_ID; // your server ID

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ]
});

const invitesCache = new Map();
const inviteCounts = new Map();
const whitelist = new Set();

client.once('ready', async () => {
  console.log('Bot online');

  for (const [guildId, guild] of client.guilds.cache) {
    const invites = await guild.invites.fetch();
    invitesCache.set(guildId, new Map(invites.map(i => [i.code, i.uses])));
  }
});

const COOLDOWN = 7 * 24 * 60 * 60 * 1000;
const lastClaim = new Map();

const OWNER_ID = "1479872190563487969";

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName !== 'getkey') return;

  const userId = interaction.user.id;

  await interaction.deferReply({ ephemeral: true });

  // OWNER bypass
  if (userId === OWNER_ID) {
    const res = await axios.get('https://yo-bot--ankymacro1.replit.app/keys');
    const key = res.data?.[0];

    if (!key || key.includes("<")) {
      return interaction.editReply("No valid key returned from backend.");
    }

    return interaction.editReply(`Owner key: ${key}`);
  }

  // whitelist check
  if (!whitelist.has(userId)) {
    return interaction.editReply("Invite 1 person first.");
  }

  // cooldown
  const now = Date.now();
  const last = lastClaim.get(userId) || 0;

  if (now - last < COOLDOWN) {
    const hours = Math.ceil((COOLDOWN - (now - last)) / 3600000);
    return interaction.editReply(`Wait ${hours}h before using again.`);
  }

  try {
    const res = await axios.get('https://yo-bot--ankymacro1.replit.app/keys');
    const key = res.data?.[0];

    // safety check (prevents "<" fake output issue)
    if (!key || typeof key !== "string" || key.length < 5) {
      return interaction.editReply("Backend returned invalid key.");
    }

    lastClaim.set(userId, now);

    return interaction.editReply(`Your key: ${key}`);
  } catch (err) {
    console.error(err);
    return interaction.editReply("Error getting key.");
  }
});

client.login(TOKEN);
