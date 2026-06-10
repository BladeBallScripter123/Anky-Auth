import {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  REST,
  Routes,
  SlashCommandBuilder,
} from "discord.js";
import axios from "axios";

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const API = "https://yo-bot--ankymacro1.replit.app";

const rest = new REST({ version: "10" }).setToken(process.env.TOKEN!);

const commands = [
  new SlashCommandBuilder()
    .setName("dashboard")
    .setDescription("Live key system dashboard"),
].map((c) => c.toJSON());

async function register() {
  await rest.put(Routes.applicationCommands(process.env.CLIENT_ID!), {
    body: commands,
  });
}

function headers() {
  return { "x-admin-secret": process.env.ADMIN_SECRET! };
}

client.once("ready", async () => {
  console.log("Bot online");
  await register();
});

client.on("interactionCreate", async (i) => {
  if (!i.isChatInputCommand()) return;
  if (i.commandName !== "dashboard") return;

  const [dashRes, keysRes, invRes] = await Promise.all([
    axios.get(`${API}/admin/dashboard`, { headers: headers() }),
    axios.get(`${API}/admin/keys`, { headers: headers() }),
    axios.get(`${API}/admin/invites/tree`, { headers: headers() }),
  ]);

  const dash = dashRes.data;
  const keys = keysRes.data;

  const embed = new EmbedBuilder()
    .setTitle("📊 SYSTEM V3 DASHBOARD")
    .addFields(
      { name: "Users", value: String(dash.users), inline: true },
      { name: "Active Keys", value: String(dash.keys.active), inline: true },
      { name: "Expired Keys", value: String(dash.keys.expired), inline: true },
      {
        name: "Total Clicks",
        value: String(dash.activity.clicks),
        inline: true,
      }
    )
    .setColor(0x00aaff);

  await i.reply({ embeds: [embed], ephemeral: true });
});

client.login(process.env.TOKEN!);
