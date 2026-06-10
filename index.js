const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require("discord.js");
const crypto = require("crypto");
const axios = require("axios");

/* ---------------- CONFIG ---------------- */

const OWNER_ID = "YOUR_DISCORD_ID_HERE";
const COOLDOWN = 7 * 24 * 60 * 60 * 1000;

/* ---------------- CLIENT ---------------- */

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});

/* ---------------- STATE ---------------- */

const lastClaim = new Map();
const invitesCache = new Map();
const userInviteCount = new Map();
const eligibleUsers = new Set();
const activeKeys = new Set();

/* ---------------- API SIGN ---------------- */

function sign(secret) {
  const timestamp = Date.now().toString();
  const payload = `${timestamp}.`;

  const signature = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");

  return { signature, timestamp };
}

async function getKey() {
  const { signature, timestamp } = sign(process.env.BOT_SECRET);

  const res = await axios.get(
    "https://yo-bot--ankymacro1.replit.app/api/keys/unused",
    {
      headers: {
        "x-signature": signature,
        "x-timestamp": timestamp,
      },
    }
  );

  return res.data?.key;
}

/* ---------------- COMMAND REGISTER ---------------- */

async function registerCommands() {
  const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

  const commands = [
    new SlashCommandBuilder().setName("getkey").setDescription("Get a license key"),

    new SlashCommandBuilder().setName("key_time").setDescription("Check cooldown"),

    new SlashCommandBuilder().setName("admin_invites").setDescription("Owner: invite stats"),

    new SlashCommandBuilder().setName("admin_keys").setDescription("Owner: active keys"),

    new SlashCommandBuilder()
      .setName("deactivate_key")
      .setDescription("Owner: revoke key")
      .addStringOption(o =>
        o.setName("key").setDescription("Key").setRequired(true)
      ),
  ].map(c => c.toJSON());

  console.log("Registering commands...");

  await rest.put(
    Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
    { body: commands }
  );

  console.log("Commands registered.");
}

/* ---------------- INVITES ---------------- */

client.once("ready", async () => {
  console.log(`Bot online as ${client.user.tag}`);

  await registerCommands();

  for (const [guildId, guild] of client.guilds.cache) {
    const invites = await guild.invites.fetch();

    invitesCache.set(
      guildId,
      new Map(invites.map(i => [i.code, i.uses]))
    );
  }
});

client.on("guildMemberAdd", async (member) => {
  const cached = invitesCache.get(member.guild.id) || new Map();
  const newInvites = await member.guild.invites.fetch();

  const used = newInvites.find(i =>
    (cached.get(i.code) || 0) < i.uses
  );

  if (used?.inviter) {
    const id = used.inviter.id;

    const count = userInviteCount.get(id) || 0;
    userInviteCount.set(id, count + 1);

    eligibleUsers.add(id);
  }

  invitesCache.set(
    member.guild.id,
    new Map(newInvites.map(i => [i.code, i.uses]))
  );
});

/* ---------------- COMMANDS ---------------- */

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const userId = interaction.user.id;

  /* ---------------- GET KEY ---------------- */

  if (interaction.commandName === "getkey") {
    await interaction.deferReply({ ephemeral: true });

    if (!eligibleUsers.has(userId)) {
      return interaction.editReply("Invite 1 person first.");
    }

    const now = Date.now();
    const last = lastClaim.get(userId) || 0;

    if (now - last < COOLDOWN) {
      const remaining = Math.ceil((COOLDOWN - (now - last)) / 86400000);
      return interaction.editReply(`Cooldown active: ${remaining} day(s).`);
    }

    try {
      const key = await getKey();

      if (!key) return interaction.editReply("No keys available.");

      activeKeys.add(key);
      lastClaim.set(userId, now);

      // consume invite requirement
      eligibleUsers.delete(userId);

      return interaction.editReply(`Your key: ${key}`);
    } catch (err) {
      console.error(err.message);
      return interaction.editReply("API error (owner request failed).");
    }
  }

  /* ---------------- COOLDOWN CHECK ---------------- */

  if (interaction.commandName === "key_time") {
    const now = Date.now();
    const last = lastClaim.get(userId) || 0;

    const remaining = COOLDOWN - (now - last);

    if (remaining <= 0) {
      return interaction.reply({ content: "No cooldown active.", ephemeral: true });
    }

    const hours = Math.ceil(remaining / 3600000);

    return interaction.reply({
      content: `Cooldown remaining: ${hours} hour(s)`,
      ephemeral: true,
    });
  }

  /* ---------------- ADMIN: INVITES ---------------- */

  if (interaction.commandName === "admin_invites") {
    if (userId !== OWNER_ID)
      return interaction.reply({ content: "No access", ephemeral: true });

    const data =
      [...userInviteCount.entries()]
        .map(([id, c]) => `${id} → ${c}`)
        .join("\n") || "No data";

    return interaction.reply({ content: data, ephemeral: true });
  }

  /* ---------------- ADMIN: KEYS ---------------- */

  if (interaction.commandName === "admin_keys") {
    if (userId !== OWNER_ID)
      return interaction.reply({ content: "No access", ephemeral: true });

    const data = [...activeKeys].join("\n") || "No active keys";

    return interaction.reply({ content: data, ephemeral: true });
  }

  /* ---------------- ADMIN: REVOKE ---------------- */

  if (interaction.commandName === "deactivate_key") {
    if (userId !== OWNER_ID)
      return interaction.reply({ content: "No access", ephemeral: true });

    const key = interaction.options.getString("key");

    activeKeys.delete(key);

    try {
      await axios.post(
        "https://yo-bot--ankymacro1.replit.app/api/keys/logout",
        { key }
      );
    } catch (err) {
      console.error(err.message);
    }

    return interaction.reply({ content: `Revoked: ${key}`, ephemeral: true });
  }
});

/* ---------------- START ---------------- */

client.login(process.env.TOKEN);
