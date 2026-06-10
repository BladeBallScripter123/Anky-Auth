const { Client, GatewayIntentBits, EmbedBuilder } = require("discord.js");
const axios = require("axios");

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

const API = "https://yo-bot--ankymacro1.replit.app";

function headers() {
  return { Authorization: process.env.ADMIN_KEY };
}

/* ---------------- DASHBOARD ---------------- */

client.once("ready", () => {
  console.log("Admin bot online");
});

/* ---------------- COMMAND ---------------- */

client.on("interactionCreate", async (i) => {
  if (!i.isChatInputCommand()) return;

  /* ---- LIVE DASHBOARD ---- */
  if (i.commandName === "dashboard") {
    const [users, keys] = await Promise.all([
      axios.get(`${API}/admin/invites`, { headers: headers() }),
      axios.get(`${API}/admin/keys`, { headers: headers() }),
    ]);

    const embed = new EmbedBuilder()
      .setTitle("📊 Live Key Dashboard")
      .addFields(
        {
          name: "Users",
          value: `${users.data.length}`,
        },
        {
          name: "Active Keys",
          value: `${keys.data.filter(k => !k.revoked).length}`,
        },
        {
          name: "Expired Keys",
          value: `${keys.data.filter(k => k.expired).length}`,
        }
      )
      .setColor("Blue");

    return i.reply({ embeds: [embed], ephemeral: true });
  }
});

client.login(process.env.TOKEN);
