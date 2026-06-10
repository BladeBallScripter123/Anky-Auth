import { Client, GatewayIntentBits } from "discord.js";
import axios from "axios";

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

const API = process.env.API_URL as string;

/* ---------------- KEY SYSTEM ---------------- */

async function getKey(user: any) {
  const res = await axios.get(`${API}/api/keys/unused`, {
    headers: {
      Authorization: process.env.BOT_SECRET as string,
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

/* ---------------- COMMAND HANDLER ---------------- */

client.on("interactionCreate", async (i) => {
  if (!i.isChatInputCommand()) return;

  /* /getkey */
  if (i.commandName === "getkey") {
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
  }

  /* /dashboard */
  if (i.commandName === "dashboard") {
    await i.deferReply({ flags: 64 });

    try {
      const res = await axios.get(`${API}/admin/stats`, {
        headers: {
          "x-admin-secret": process.env.ADMIN_SECRET as string,
        },
      });

      const data = res.data;

      return i.editReply(
        `Total: ${data.total}\nUsed: ${data.used}\nUnused: ${data.unused}\nRevoked: ${data.revoked}`
      );
    } catch (err) {
      console.error(err);
      return i.editReply("Dashboard error.");
    }
  }
});

/* ---------------- READY ---------------- */

client.once("ready", () => {
  console.log("Bot online");
});

client.login(process.env.TOKEN);
