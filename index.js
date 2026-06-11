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

  if (i.commandName === "dashboard") {
  const res = await axios.get(`${API}/api/admin/stats`, {
    headers: {
      "x-admin-secret": process.env.ADMIN_SECRET,
    },
  });

  const data = res.data || {};

  const embed = new EmbedBuilder()
    .setTitle("📊 AnkyAuth Dashboard")
    .setColor(0x5865f2)
    .addFields(
      { name: "Total Keys", value: String(data.total ?? 0), inline: true },
      { name: "Used", value: String(data.used ?? 0), inline: true },
      { name: "Unused", value: String(data.unused ?? 0), inline: true },
      { name: "Revoked", value: String(data.revoked ?? 0), inline: true }
    )
    .setFooter({ text: "AnkyAuth System" })
    .setTimestamp();

  return i.editReply({ embeds: [embed] });
}

client.once("ready", () => {
  console.log("Bot online");
});

client.login(process.env.TOKEN);
