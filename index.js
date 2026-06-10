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
client.on('guildMemberAdd', async (member) => {
  const guild = member.guild;

  const oldInvites = invitesCache.get(guild.id);
  const newInvites = await guild.invites.fetch();

  let usedInvite = null;

  for (const invite of newInvites.values()) {
    const prev = oldInvites.get(invite.code) || 0;
    if (invite.uses > prev) {
      usedInvite = invite;
      break;
    }
  }

  invitesCache.set(guild.id, new Map(newInvites.map(i => [i.code, i.uses])));
  if (!usedInvite) return;

  const inviterId = usedInvite.inviter.id;

  // increment invite count
  const count = (inviteCounts.get(inviterId) || 0) + 1;
  inviteCounts.set(inviterId, count);

  console.log(`${inviterId} now has ${count} invites`);

  // whitelist after 1 invite
  if (count >= 1) {
    whitelist.add(inviterId);
    console.log(`${inviterId} whitelisted`);
  }
});

// slash command
const commands = [
  new SlashCommandBuilder()
    .setName('getkey')
    .setDescription('Get your key')
    .toJSON()
];

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
  await rest.put(
    Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
    { body: commands }
  );
  console.log('Commands registered');
})();

// command handler
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'getkey') {
    const userId = interaction.user.id;

    if (!whitelist.has(userId)) {
      return interaction.reply({
        content: 'Invite 1 person first.',
        ephemeral: true
      });
    }

    console.log("CLIENT_ID:", CLIENT_ID);
  
    try {
      const res = await axios.get('https://yo-bot--ankymacro1.replit.app/keys');
      const key = res.data[0]; // adjust if needed

      await interaction.reply({
        content: `Your key: ${key}`,
        ephemeral: true
      });
    } catch (err) {
      await interaction.reply({
        content: 'Error getting key.',
        ephemeral: true
      });
    }
  }
});

client.login(TOKEN);
