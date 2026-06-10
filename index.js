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

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'getkey') {
    const userId = interaction.user.id;

    await interaction.deferReply({ ephemeral: true });

    // whitelist check
    if (!whitelist.has(userId)) {
      return interaction.editReply('Invite 1 person first.');
    }

    const now = Date.now();
    const last = lastClaim.get(userId) || 0;

    if (now - last < COOLDOWN) {
      const remaining = COOLDOWN - (now - last);
      const hours = Math.ceil(remaining / (1000 * 60 * 60));

      return interaction.editReply(`You must wait ${hours}h before using this again.`);
    }

    try {
      const res = await axios.get('https://yo-bot--ankymacro1.replit.app/keys');
      const key = res.data[0];

      lastClaim.set(userId, now);

      return interaction.editReply(`Your key: ${key}`);
    } catch (err) {
      console.error(err);
      return interaction.editReply('Error getting key.');
    }
  }
});

client.login(TOKEN);
