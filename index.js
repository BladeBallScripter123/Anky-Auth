import { Client, GatewayIntentBits } from "discord.js";
import axios from "axios";

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

const API = process.env.API_URL;

/* ---------------- KEY SYSTEM ---------------- */

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

/* ---------------- COMMAND HANDLER ---------------- */

client.on("interactionCreate", async (i) => {
  if (!i.isChatInputCommand()) return;

  // GETKEY
  if (i.commandName === "getkey") {
    await i.deferReply({ flags: 64 });

    try {
      const key = await getKey(i.user);

      if (!key) return i.editReply("No keys available.");

      return i.editReply(`Key: ${key}`);
    } catch (err) {
      console.error("GETKEY ERROR:", err.response?.data || err);
      return i.editReply("Error getting key.");
    }
  }

  // DASHBOARD
  if (i.commandName === "dashboard") {
    await i.deferReply({ flags: 64 });

    try {
      const res = await axios.get(`${API}/admin/stats`, {
        headers: {
          "x-admin-secret": process.env.ADMIN_SECRET,
        },
      });

      // 🚨 detect if you hit frontend instead of API
      if (typeof res.data === "string" && res.data.includes("<!DOCTYPE html>")) {
        console.log("HIT FRONTEND INSTEAD OF API");
        return i.editReply("API routing is wrong (returning HTML).");
      }

      console.log("STATS RESPONSE:", res.data);

      const data = res.data || {};

      return i.editReply(
        `Total: ${data.total ?? "?"}\nUsed: ${data.used ?? "?"}\nUnused: ${data.unused ?? "?"}\nRevoked: ${data.revoked ?? "?"}`
      );
    } catch (err) {
      console.error("DASHBOARD ERROR:", err.response?.data || err);
      return i.editReply("Dashboard error.");
    }
  }
});

/* ---------------- READY ---------------- */

client.once("ready", () => {
  console.log("Bot online");
});

client.login(process.env.TOKEN);
