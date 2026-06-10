const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ]
});

client.once('ready', () => {
  console.log('Bot online');
});

client.on('guildMemberAdd', (member) => {
  console.log(`${member.user.tag} joined`);
});

client.login(process.env.TOKEN);
