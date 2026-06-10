const { Client, GatewayIntentBits } = require('discord.js');
const axios = require('axios');

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

const API_URL = 'https://yo-bot--ankymacro1.replit.app/api/keys/unused';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ]
});

const invitesCache = new Map();
const whitelist = new Set();

const COOLDOWN = 7 * 24 * 60 * 60 * 1000;
const lastClaim = new Map();

const OWNER_ID = "1479872190563487969";

/* =========================
   INVITE CACHE INIT
========================= */
client.once('ready', async () => {
  console.log('Bot online');

  for (const guild of client.guilds.cache.values()) {
    try {
      const invites = await guild.invites.fetch();

      invitesCache.set(
        guild.id,
        new Map(invites.map(inv => [inv.code, inv.uses || 0]))
      );
    } catch (err) {
      console.error("Invite fetch error:", err);
    }
  }
});

/* =========================
   INVITE TRACKING
========================= */
client.on('guildMemberAdd', async (member) => {
  try {
    const cached = invitesCache.get(member.guild.id) || new Map();

    const newInvites = await member.guild.invites.fetch();

    const usedInvite = newInvites.find(inv => {
      const oldUses = cached.get(inv.code) || 0;
      return inv.uses > oldUses;
    });

    invitesCache.set(
      member.guild.id,
      new Map(newInvites.map(inv => [inv.code, inv.uses || 0]))
    );

    if (!usedInvite || !usedInvite.inviter) return;

    const inviterId = usedInvite.inviter.id;
    whitelist.add(inviterId);

  } catch (err) {
    console.error("Invite tracking error:", err);
  }
});

/* =========================
   COMMAND HANDLER
========================= */
client.on('interactionCreate', async (interaction) => {
  try {
    if (!interaction.isChatInputCommand()) return;
    if (interaction.commandName !== 'getkey') return;

    const userId = interaction.user.id;

    await interaction.deferReply({ ephemeral: true });

    /* OWNER OVERRIDE */
    if (userId === OWNER_ID) {
      try {
        const res = await axios.get(API_URL, {
          timeout: 8000,
          headers: {
            authorization: process.env.ADMIN_KEY
          }
        });

        const key = res.data?.key;
        return interaction.editReply(`Owner key: ${key ?? "none available"}`);
      } catch (err) {
        console.error("Owner API error:", err?.message);
        return interaction.editReply("API error (owner request failed).");
      }
    }

    /* NORMAL USERS */
    if (!whitelist.has(userId)) {
      return interaction.editReply("Invite 1 person first.");
    }

    const now = Date.now();
    const last = lastClaim.get(userId) || 0;

    if (now - last < COOLDOWN) {
      return interaction.editReply("Cooldown active.");
    }

    let key;

    try {
      const res = await axios.get(API_URL, {
        timeout: 8000,
        headers: {
          authorization: process.env.ADMIN_KEY
        }
      });

      key = res.data?.key;
    } catch (err) {
      console.error("User API error:", err?.message);
      return interaction.editReply("API error. Try again later.");
    }

    if (!key) {
      return interaction.editReply("No keys available.");
    }

    lastClaim.set(userId, now);

    return interaction.editReply(`Your key: ${key}`);
  } catch (err) {
    console.error("Interaction crash:", err);

    try {
      if (interaction.deferred || interaction.replied) {
        return interaction.editReply("Something went wrong.");
      } else {
        return interaction.reply({ content: "Something went wrong.", ephemeral: true });
      }
    } catch {}
  }
});

client.login(TOKEN);
