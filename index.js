import { Client, GatewayIntentBits, EmbedBuilder } from "discord.js";
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

if (i.commandName === "keys") {
  const res = await axios.get(`${API}/api/admin/keys`, {
    headers: {
      "x-admin-secret": process.env.ADMIN_SECRET,
    },
  });

  const keys = res.data.slice(0, 10);

  const text = keys
    .map(k => `${k.key} | ${k.used ? "USED" : "FREE"}`)
    .join("\n");

  return i.editReply(text || "No keys.");
}

if (i.commandName === "activity") {
  const res = await axios.get(`${API}/api/admin/activity`, {
    headers: {
      "x-admin-secret": process.env.ADMIN_SECRET,
    },
  });

  const logs = res.data.slice(0, 10);

  const text = logs
    .map(l => `${l.event} | ${l.key ?? "no-key"} | ${l.createdAt}`)
    .join("\n");

  return i.editReply(text || "No activity.");
}

client.on("interactionCreate", async (i) => {
  if (!i.isChatInputCommand()) return;

  try {
    if (!i.deferred && !i.replied) {
      await i.deferReply({ flags: 64 }).catch(() => {});
    }

    // GETKEY
    if (i.commandName === "getkey") {
      const key = await getKey(i.user);

      if (!key) return i.editReply("No keys available.");

      return i.editReply(`Key: ${key}`);
    }

    // DASHBOARD
    if (i.commandName === "dashboard") {
      const res = await axios.get(`${API}/api/admin/stats`, {
        headers: {
          "x-admin-secret": process.env.ADMIN_SECRET,
        },
      });

      const data = res.data || {};

      const percent = data.total
        ? Math.round((data.used / data.total) * 100)
        : 0;

      const embed = new EmbedBuilder()
        .setTitle("📊 AnkyAuth Dashboard")
        .setColor(
          percent > 80 ? 0xff0000 : percent > 50 ? 0xffa500 : 0x00ff00
        )
        .addFields(
          { name: "Total Keys", value: String(data.total ?? 0), inline: true },
          { name: "Used", value: String(data.used ?? 0), inline: true },
          { name: "Unused", value: String(data.unused ?? 0), inline: true },
          { name: "Revoked", value: String(data.revoked ?? 0), inline: true },
          { name: "Usage", value: `${percent}%`, inline: true }
        )
        .setFooter({ text: "AnkyAuth System" })
        .setTimestamp();

      return i.editReply({ embeds: [embed] });
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
