const { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes } = require("discord.js");
const axios = require("axios");

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const API = process.env.API_URL;

/* ---------------- GET KEY ---------------- */

async function getKey() {
  const res = await axios.get(`${API}/keys/unused`, {
    headers: { Authorization: process.env.BOT_SECRET },
  });

  return res.data?.key;
}

/* ---------------- COMMAND ---------------- */

const commands = [
  new SlashCommandBuilder()
    .setName("getkey")
    .setDescription("Get your key"),
].map(c => c.toJSON());

const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

client.once("ready", async () => {
  await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), {
    body: commands,
  });

  console.log("Bot ready");
});

client.on("interactionCreate", async (i) => {
  if (!i.isChatInputCommand()) return;
  if (i.commandName !== "getkey") return;

  await i.deferReply({ ephemeral: true });

  const key = await getKey();
  if (!key) return i.editReply("No keys available");

  i.editReply(`Key: ${key}`);
});

client.login(process.env.TOKEN);
