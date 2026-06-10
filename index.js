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

// track invites
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'getkey') {
    const userId = interaction.user.id;

    try {
      await interaction.deferReply({ ephemeral: true }); // <-- ADD THIS

      if (!whitelist.has(userId)) {
        return interaction.editReply({
          content: 'Invite 1 person first.'
        });
      }

      const res = await axios.get('https://yo-bot--ankymacro1.replit.app/keys');
      const key = res.data[0];

      await interaction.editReply({
        content: `Your key: ${key}`
      });

    } catch (err) {
      console.error(err);

      if (interaction.deferred) {
        await interaction.editReply({
          content: 'Error getting key.'
        });
      } else {
        await interaction.reply({
          content: 'Error getting key.',
          ephemeral: true
        });
      }
    }
  }
});

client.login(TOKEN);
