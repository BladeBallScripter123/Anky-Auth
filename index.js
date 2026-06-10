const { Client, GatewayIntentBits } = require("discord.js");
const crypto = require("crypto");
const axios = require("axios");

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

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

client.once("ready", async () => {
  console.log(`Bot online as ${client.user.tag}`);

  await registerCommands();
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName !== "getkey") return;

  await interaction.deferReply({ ephemeral: true });

  try {
    const key = await getKey();

    if (!key) {
      return interaction.editReply("No keys available.");
    }

    return interaction.editReply(`Your key: ${key}`);
  } catch (err) {
    console.error("API error:", err?.response?.data || err.message);
    return interaction.editReply("API error (owner request failed).");
  }
});

const { REST, Routes, SlashCommandBuilder } = require("discord.js");

async function registerCommands() {
  const TOKEN = process.env.TOKEN;
  const CLIENT_ID = process.env.CLIENT_ID;
  const GUILD_ID = process.env.GUILD_ID;

  const commands = [
    new SlashCommandBuilder()
      .setName("getkey")
      .setDescription("Get a license key")
      .toJSON(),
  ];

  const rest = new REST({ version: "10" }).setToken(TOKEN);

  try {
    console.log("Registering commands...");

    await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
      { body: commands }
    );

    console.log("Commands registered.");
  } catch (err) {
    console.error("Command register error:", err);
  }
}

client.login(process.env.TOKEN);
