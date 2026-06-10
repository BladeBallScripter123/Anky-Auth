const {
  Client,
  GatewayIntentBits,
  SlashCommandBuilder,
  REST,
  Routes,
  EmbedBuilder,
} = require("discord.js");
const axios = require("axios");

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const API = process.env.API_URL;

function adminHeaders() {
  return { "x-admin-secret": process.env.ADMIN_SECRET };
}

/* ---------------- COMMANDS ---------------- */

const commands = [
  new SlashCommandBuilder()
    .setName("getkey")
    .setDescription("Get a license key"),

  new SlashCommandBuilder()
    .setName("dashboard")
    .setDescription("Admin dashboard"),

  new SlashCommandBuilder()
    .setName("keys")
    .setDescription("View all keys (admin)"),

  new SlashCommandBuilder()
    .setName("invites")
    .setDescription("View invite stats (admin)"),

  new SlashCommandBuilder()
    .setName("activity")
    .setDescription("View audit logs (admin)"),
].map(c => c.toJSON());

const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

/* ---------------- REGISTER ---------------- */

client.once("ready", async () => {
  await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), {
    body: commands,
  });

  console.log("Bot online");
});

/* ---------------- KEY FETCH ---------------- */

async function getKey() {
  const res = await axios.get(`${API}/keys/unused`, {
    headers: { Authorization: process.env.BOT_SECRET },
  });

  return res.data?.key;
}

/* ---------------- COMMAND HANDLER ---------------- */

client.on("interactionCreate", async (i) => {
  if (!i.isChatInputCommand()) return;

  /* USER COMMAND */
  if (i.commandName === "getkey") {
    await i.deferReply({ ephemeral: true });

    const key = await getKey();
    if (!key) return i.editReply("No keys available");

    return i.editReply(`Key: ${key}`);
  }

  /* ADMIN DASHBOARD */
  if (i.commandName === "dashboard") {
    const [keys, invites] = await Promise.all([
      axios.get(`${API}/admin/keys`, { headers: adminHeaders() }),
      axios.get(`${API}/admin/invites`, { headers: adminHeaders() }),
    ]);

    const k = keys.data;
    const u = invites.data;

    const embed = new EmbedBuilder()
      .setTitle("Live Dashboard")
      .addFields(
        { name: "Total Keys", value: String(k.length), inline: true },
        { name: "Active", value: String(k.filter(x => !x.expired).length), inline: true },
        { name: "Users", value: String(u.length), inline: true },
      )
      .setColor(0x00aaff);

    return i.reply({ embeds: [embed], ephemeral: true });
  }

  /* ADMIN KEYS LIST */
  if (i.commandName === "keys") {
    const res = await axios.get(`${API}/admin/keys`, { headers: adminHeaders() });

    return i.reply({
      content: JSON.stringify(res.data, null, 2).slice(0, 1900),
      ephemeral: true,
    });
  }

  /* ADMIN INVITES */
  if (i.commandName === "invites") {
    const res = await axios.get(`${API}/admin/invites`, { headers: adminHeaders() });

    return i.reply({
      content: JSON.stringify(res.data, null, 2).slice(0, 1900),
      ephemeral: true,
    });
  }

  /* AUDIT LOGS */
  if (i.commandName === "activity") {
    const res = await axios.get(`${API}/admin/activity`, { headers: adminHeaders() });

    return i.reply({
      content: JSON.stringify(res.data, null, 1900),
      ephemeral: true,
    });
  }
});

client.login(process.env.TOKEN);
