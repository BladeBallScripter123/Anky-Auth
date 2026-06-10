import { Client, GatewayIntentBits, EmbedBuilder, REST, Routes, SlashCommandBuilder } from "discord.js";
import axios from "axios";

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

const API = process.env.API_URL || "";

/* ---------------- HEADERS ---------------- */

function headers() {
  return {
    Authorization: process.env.ADMIN_SECRET || "",
  };
}

/* ---------------- REGISTER COMMAND ---------------- */

const commands = [
  new SlashCommandBuilder()
    .setName("dashboard")
    .setDescription("View live key system stats"),
  new SlashCommandBuilder()
    .setName("getkey")
    .setDescription("Get a license key")
].map(c => c.toJSON());

const rest = new REST({ version: "10" }).setToken(process.env.TOKEN || "");

async function register() {
  if (!process.env.CLIENT_ID || !process.env.TOKEN) return;

  await rest.put(
    Routes.applicationCommands(process.env.CLIENT_ID),
    { body: commands }
  );
}

/* ---------------- READY ---------------- */

client.once("clientReady", async () => {
  console.log("Bot online");
  await register();
});

/* ---------------- DASHBOARD ---------------- */

client.on("interactionCreate", async (i) => {
  if (!i.isChatInputCommand()) return;

  try {
    /* DASHBOARD */
    if (i.commandName === "dashboard") {
      const [usersRes, keysRes] = await Promise.all([
        axios.get(`${API}/admin/invites`, { headers: headers() }),
        axios.get(`${API}/admin/keys`, { headers: headers() }),
      ]);

      const users = usersRes.data || [];
      const keys = keysRes.data || [];

      const embed = new EmbedBuilder()
        .setTitle("📊 Live Key Dashboard")
        .addFields(
          { name: "Users", value: String(users.length), inline: true },
          { name: "Active Keys", value: String(keys.filter((k: any) => !k.revoked).length), inline: true },
          { name: "Total Keys", value: String(keys.length), inline: true },
        )
        .setColor(0x3498db);

      return i.reply({
        embeds: [embed],
        ephemeral: true,
      } as any);
    }

    /* GET KEY */
    if (i.commandName === "getkey") {
      const res = await axios.get(`${API}/keys/unused`, {
        headers: headers(),
      });

      const key = res.data?.key;

      if (!key) {
        return i.reply({ content: "No keys available", ephemeral: true } as any);
      }

      await axios.post(`${API}/keys/mark-used`, {
        key,
        userId: i.user.id,
        username: i.user.username,
      }, { headers: headers() });

      return i.reply({
        content: `Your key: ${key}`,
        ephemeral: true,
      } as any);
    }

  } catch (err) {
    console.error(err);
    return i.reply({
      content: "API error",
      ephemeral: true,
    } as any);
  }
});

/* ---------------- START ---------------- */

client.login(process.env.TOKEN || "");
