import {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  REST,
  Routes,
  SlashCommandBuilder,
  ChatInputCommandInteraction,
} from "discord.js";
import axios from "axios";

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

const API = "https://yo-bot--ankymacro1.replit.app";

function headers() {
  return { Authorization: process.env.ADMIN_KEY! };
}

/* ---------------- COMMAND SETUP ---------------- */

const commands = [
  new SlashCommandBuilder()
    .setName("dashboard")
    .setDescription("View live key system stats"),
].map((c) => c.toJSON());

const rest = new REST({ version: "10" }).setToken(process.env.TOKEN!);

async function registerCommands() {
  await rest.put(
    Routes.applicationGuildCommands(
      process.env.CLIENT_ID!,
      process.env.GUILD_ID! // IMPORTANT FIX
    ),
    { body: commands }
  );
}

/* ---------------- READY ---------------- */

client.once("ready", async () => {
  console.log(`Admin bot online: ${client.user?.tag}`);
  await registerCommands();
});

/* ---------------- COMMAND HANDLER ---------------- */

client.on("interactionCreate", async (i: ChatInputCommandInteraction) => {
  if (!i.isChatInputCommand()) return;
  if (i.commandName !== "dashboard") return;

  try {
    const [usersRes, keysRes] = await Promise.all([
      axios.get(`${API}/admin/invites`, { headers: headers() }),
      axios.get(`${API}/admin/keys`, { headers: headers() }),
    ]);

    const users = usersRes.data ?? [];
    const keys = keysRes.data ?? [];

    const embed = new EmbedBuilder()
      .setTitle("📊 Live Key Dashboard")
      .addFields(
        {
          name: "Users",
          value: String(users.length),
          inline: true,
        },
        {
          name: "Active Keys",
          value: String(keys.filter((k: any) => !k.revoked && !k.expired).length),
          inline: true,
        },
        {
          name: "Expired Keys",
          value: String(keys.filter((k: any) => k.expired).length),
          inline: true,
        }
      )
      .setColor(0x3498db);

    await i.reply({ embeds: [embed], ephemeral: true });
  } catch (err) {
    console.error(err);
    await i.reply({
      content: "Dashboard failed to load",
      ephemeral: true,
    });
  }
});

client.login(process.env.TOKEN!);
