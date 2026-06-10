import {
  Client,
  GatewayIntentBits,
  SlashCommandBuilder,
  REST,
  Routes,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import axios from "axios";

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const API = process.env.API_URL!;
const ADMIN_SECRET = process.env.ADMIN_SECRET!;

let lastMessage: any = null;

/* ---------------- COMMAND ---------------- */

const commands = [
  new SlashCommandBuilder()
    .setName("dashboard")
    .setDescription("Live system dashboard"),
].map(c => c.toJSON());

const rest = new REST({ version: "10" }).setToken(process.env.TOKEN!);

client.once("ready", async () => {
  await rest.put(Routes.applicationCommands(process.env.CLIENT_ID!), {
    body: commands,
  });

  console.log("Dashboard v2 ready");
});

/* ---------------- RENDER DASHBOARD ---------------- */

async function buildDashboard() {
  const res = await axios.get(`${API}/admin/summary`, {
    headers: { "x-admin-secret": ADMIN_SECRET },
  });

  const d = res.data;

  const embed = new EmbedBuilder()
    .setTitle("📊 Live Dashboard v2")
    .setColor(0x2b2d31)
    .addFields(
      { name: "Total Keys", value: String(d.totalKeys), inline: true },
      { name: "Active", value: String(d.activeKeys), inline: true },
      { name: "Expired", value: String(d.expiredKeys), inline: true },
      { name: "Users", value: String(d.users), inline: true },
      { name: "Invites", value: String(d.totalInvites), inline: true },
    );

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("refresh")
      .setLabel("Refresh")
      .setStyle(ButtonStyle.Primary),
  );

  return { embeds: [embed], components: [row] };
}

/* ---------------- COMMAND HANDLER ---------------- */

client.on("interactionCreate", async (i) => {
  if (i.isChatInputCommand() && i.commandName === "dashboard") {
    const msg = await buildDashboard();
    const sent = await i.reply({ ...msg, ephemeral: true, fetchReply: true });

    lastMessage = sent;
  }

  if (i.isButton() && i.customId === "refresh") {
    const msg = await buildDashboard();
    await i.update(msg);
  }
});

/* ---------------- AUTO REFRESH (LIVE FEEL) ---------------- */

setInterval(async () => {
  if (!lastMessage) return;

  try {
    const msg = await buildDashboard();
    await lastMessage.edit(msg);
  } catch {}
}, 10000);

client.login(process.env.TOKEN);
