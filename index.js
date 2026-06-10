const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require("discord.js");
const axios = require("axios");
const crypto = require("crypto");

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

const API = "https://yo-bot--ankymacro1.replit.app";

/* ---------------- SIGN ---------------- */

function sign(secret) {
  const timestamp = Date.now().toString();
  const payload = `${timestamp}.`;

  const signature = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");

  return { signature, timestamp };
}

/* ---------------- GET KEY ---------------- */

async function getKey() {
  const secret = process.env.BOT_SECRET;
  if (!secret) throw new Error("BOT_SECRET missing");

  const { signature, timestamp } = sign(secret);

  const res = await axios.get(`${API}/keys/unused`, {
    headers: {
      "x-signature": signature,
      "x-timestamp": timestamp,
    },
    timeout: 8000,
  });

  return res.data?.key;
}

/* ---------------- COMMANDS ---------------- */

const commands = [
  new SlashCommandBuilder()
    .setName("getkey")
    .setDescription("Get a license key"),
].map(c => c.toJSON());

const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

async function register() {
  await rest.put(
    Routes.applicationCommands(process.env.CLIENT_ID),
    { body: commands }
  );
}

/* ---------------- READY ---------------- */

client.once("ready", async () => {
  console.log(`Bot online: ${client.user.tag}`);
  await register();
});

/* ---------------- INTERACTION ---------------- */

client.on("interactionCreate", async (i) => {
  if (!i.isChatInputCommand()) return;
  if (i.commandName !== "getkey") return;

  await i.deferReply({ ephemeral: true });

  try {
    const key = await getKey();

    if (!key) {
      return i.editReply("No keys available.");
    }

    return i.editReply(`Your key: ${key}`);
  } catch (err) {
    console.error(err?.response?.data || err.message);
    return i.editReply("API error.");
  }
});

client.login(process.env.TOKEN);
