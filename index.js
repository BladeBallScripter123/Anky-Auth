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

  try {
    // ALWAYS defer safely (prevents 10062 crash)
    if (!i.deferred && !i.replied) {
      await i.deferReply({ flags: 64 }).catch(() => {});
    }

    /* ---------------- GETKEY ---------------- */
    if (i.commandName === "getkey") {
      const key = await getKey(i.user);

      if (!key) {
        return i.editReply("No keys available.");
      }

      return i.editReply(`Key: ${key}`);
    }

    /* ---------------- DASHBOARD ---------------- */
    if (i.commandName === "dashboard") {
      const res = await axios.get(`${API}/api/admin/stats`, {
        headers: {
          "x-admin-secret": process.env.ADMIN_SECRET,
        },
      });

      // detect wrong routing (HTML instead of JSON)
      if (typeof res.data === "string" && res.data.includes("<!DOCTYPE html>")) {
        console.log("HIT FRONTEND INSTEAD OF API");
        return i.editReply("API routing is wrong (returning HTML).");
      }

      console.log("STATS RESPONSE:", res.data);

      const data = res.data || {};

      return i.editReply(
        `Total: ${data.total ?? "?"}\nUsed: ${data.used ?? "?"}\nUnused: ${data.unused ?? "?"}\nRevoked: ${data.revoked ?? "?"}`
      );
    }

  } catch (err) {
    console.error("INTERACTION ERROR:", err);

    if (!i.replied) {
      await i.reply({ content: "Error.", flags: 64 }).catch(() => {});
    }
  }
});

/* ---------------- READY ---------------- */

client.once("ready", () => {
  console.log("Bot online");
});

client.login(process.env.TOKEN);
