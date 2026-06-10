const { Client, GatewayIntentBits } = require("discord.js");
const axios = require("axios");

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

const API = process.env.API_URL;

async function getKey(user) {
  const res = await axios.get(`${API}/api/keys/unused`, {
    headers: {
      Authorization: process.env.BOT_SECRET,
    },
  });

  const key = res.data?.key;

  if (key) {
    await axios.post(`${API}/api/keys/assign`, {
      key,
      userId: user.id,
      username: user.username,
    });
  }

  return key;
}

client.on("interactionCreate", async (i) => {
  if (!i.isChatInputCommand()) return;
  if (i.commandName !== "getkey") return;

  await i.deferReply({ flags: 64 });

  try {
    const key = await getKey(i.user);

    if (!key) {
      return i.editReply("No keys available.");
    }

    return i.editReply(`Key: ${key}`);
  } catch (err) {
    console.error(err);
    return i.editReply("Error.");
  }
});

client.once("ready", () => {
  console.log("Bot online");
});

client.login(process.env.TOKEN);
