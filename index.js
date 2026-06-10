import {
  Client,
  GatewayIntentBits,
  SlashCommandBuilder,
  REST,
  Routes,
  EmbedBuilder,
} from "discord.js";
import axios from "axios";

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

const API = process.env.API_URL!;
const ADMIN_SECRET = process.env.ADMIN_SECRET!;

/* ---------------- REGISTER ---------------- */

const commands = [
  new SlashCommandBuilder()
    .setName("getkey")
    .setDescription("Get your key"),
  new SlashCommandBuilder()
    .setName("dashboard")
    .setDescription("Admin dashboard"),
].map(c => c.toJSON());

const rest = new REST({ version: "10" }).setToken(process.env.TOKEN!);

client.once("ready", async () => {
  await rest.put(Routes.applicationCommands(process.env.CLIENT_ID!), {
    body: commands,
  });

  console.log("Bot ready");
});

/* ---------------- COMMANDS ---------------- */

client.on("interactionCreate", async (i) => {
  if (!i.isChatInputCommand()) return;

  /* GET KEY */
  if (i.commandName === "getkey") {
    const res = await axios.post(`${API}/keys/issue`, {
      userId: i.user.id,
    });

    return i.reply({
      content: `Your key: ${res.data.key}`,
      ephemeral: true,
    });
  }

  /* DASHBOARD */
  if (i.commandName === "dashboard") {
    const res = await axios.get(`${API}/admin/keys`, {
      headers: { "x-admin-secret": ADMIN_SECRET },
    });

    const keys = res.data;

    const embed = new EmbedBuilder()
      .setTitle("Live Key Dashboard")
      .addFields(
        {
          name: "Total Keys",
          value: String(keys.length),
          inline: true,
        },
        {
          name: "Active",
          value: String(keys.filter((k: any) => !k.expired && !k.revoked).length),
          inline: true,
        },
        {
          name: "Expired",
          value: String(keys.filter((k: any) => k.expired).length),
          inline: true,
        }
      );

    return i.reply({ embeds: [embed], ephemeral: true });
  }
});

client.login(process.env.TOKEN!);
