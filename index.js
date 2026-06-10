import {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  REST,
  Routes,
  SlashCommandBuilder,
  InteractionReplyOptions,
} from "discord.js";

import axios from "axios";

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

/* =========================================================
   ENV SAFETY
========================================================= */

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const ADMIN_KEY = process.env.ADMIN_KEY;
const API_URL = process.env.API_URL;

if (!TOKEN) throw new Error("Missing TOKEN");
if (!CLIENT_ID) throw new Error("Missing CLIENT_ID");
if (!ADMIN_KEY) throw new Error("Missing ADMIN_KEY");
if (!API_URL) throw new Error("Missing API_URL");

/* =========================================================
   AXIOS CLIENT
========================================================= */

const api = axios.create({
  baseURL: API_URL,
  timeout: 8000,
  headers: {
    Authorization: ADMIN_KEY,
  },
});

/* =========================================================
   SLASH COMMANDS
========================================================= */

const commands = [
  new SlashCommandBuilder()
    .setName("dashboard")
    .setDescription("View live key system stats"),
].map((c) => c.toJSON());

const rest = new REST({ version: "10" }).setToken(TOKEN);

async function registerCommands() {
  try {
    await rest.put(Routes.applicationCommands(CLIENT_ID), {
      body: commands,
    });

    console.log("Slash commands registered");
  } catch (err) {
    console.error("Command register failed:", err);
  }
}

/* =========================================================
   BOT READY
========================================================= */

client.once("ready", async () => {
  console.log(`Bot online: ${client.user?.tag}`);
  await registerCommands();
});

/* =========================================================
   DASHBOARD COMMAND
========================================================= */

client.on("interactionCreate", async (interaction) => {
  try {
    if (!interaction.isChatInputCommand()) return;
    if (interaction.commandName !== "dashboard") return;

    await interaction.deferReply({
      ephemeral: true,
    } as InteractionReplyOptions);

    const [usersRes, keysRes] = await Promise.all([
      api.get("/admin/invites"),
      api.get("/admin/keys"),
    ]);

    const users = usersRes.data ?? [];
    const keys = keysRes.data ?? [];

    const activeKeys = keys.filter((k: any) => !k.revoked && !k.expired);
    const expiredKeys = keys.filter((k: any) => k.expired);

    const embed = new EmbedBuilder()
      .setTitle("📊 Live Key Dashboard")
      .setColor(0x3498db)
      .addFields(
        {
          name: "Users",
          value: String(users.length),
          inline: true,
        },
        {
          name: "Active Keys",
          value: String(activeKeys.length),
          inline: true,
        },
        {
          name: "Expired Keys",
          value: String(expiredKeys.length),
          inline: true,
        }
      );

    return interaction.editReply({
      embeds: [embed],
    });
  } catch (err) {
    console.error("Dashboard error:", err);

    if (interaction.isRepliable()) {
      return interaction.reply({
        content: "Failed to load dashboard",
        flags: 64,
      });
    }
  }
});

/* =========================================================
   GLOBAL ERROR HANDLERS (PREVENT CRASHES)
========================================================= */

process.on("unhandledRejection", (err) => {
  console.error("Unhandled promise rejection:", err);
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught exception:", err);
});

/* =========================================================
   START BOT
========================================================= */

client.login(TOKEN);
