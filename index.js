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

  // OWNER ONLY OVERRIDE (does NOT affect invite system)
  if (userId === OWNER_ID) {
    const res = await axios.get('https://yo-bot--ankymacro1.replit.app/keys');
    const key = res.data?.[0];

    return interaction.editReply(`Owner key: ${key}`);
  }

  // NORMAL USERS BELOW
  if (!whitelist.has(userId)) {
    return interaction.editReply("Invite 1 person first.");
  }

  const now = Date.now();
  const last = lastClaim.get(userId) || 0;

  if (now - last < COOLDOWN) {
    return interaction.editReply("Cooldown active.");
  }

  const res = await axios.get('https://yo-bot--ankymacro1.replit.app/keys');
  const key = res.data?.[0];

  lastClaim.set(userId, now);

  return interaction.editReply(`Your key: ${key}`);
});

client.login(TOKEN);
