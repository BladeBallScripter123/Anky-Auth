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

client.once("ready", () => {
  console.log(`Bot online as ${client.user.tag}`);
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

client.login(process.env.TOKEN);
