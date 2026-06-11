import {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import axios from "axios";

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

const API = process.env.API_URL;
const PAGE_SIZE = 10;

/* ---------------- API ---------------- */

const api = axios.create({
  baseURL: API,
  headers: { "x-admin-secret": process.env.ADMIN_SECRET },
  timeout: 5000,
});

/* ---------------- SAFE REPLY ---------------- */

async function safeReply(i, data) {
  if (i.replied || i.deferred) return i.editReply(data);
  return i.reply(data);
}

/* ---------------- UI ---------------- */

async function renderKeys(i, page = 0) {
  const res = await api.get("/api/admin/keys");
  const keys = res.data || [];

  const start = page * PAGE_SIZE;
  const pageKeys = keys.slice(start, start + PAGE_SIZE);

  const embed = new EmbedBuilder()
    .setTitle("🔑 Key Manager")
    .setDescription(`Page ${page + 1} • Total ${keys.length}`);

  const menu = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("select")
      .addOptions(
        pageKeys.map((k) => ({
          label: k.key.slice(0, 25),
          description: k.used ? "USED" : "FREE",
          value: k.key,
        }))
      )
  );

  const nav = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`prev_${page}`)
      .setLabel("Prev")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page === 0),

    new ButtonBuilder()
      .setCustomId(`next_${page}`)
      .setLabel("Next")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(start + PAGE_SIZE >= keys.length)
  );

  return safeReply(i, {
    embeds: [embed],
    components: [menu, nav],
    flags: 64,
  });
}

/* ---------------- GET KEY ---------------- */

async function getKey() {
  try {
    const res = await axios.get(`${API}/api/keys/unused`);
    return res.data?.key || null;
  } catch {
    return null;
  }
}

/* ---------------- EVENTS ---------------- */

client.on("interactionCreate", async (i) => {
  try {
    if (i.isChatInputCommand()) {
      if (i.commandName === "getkey") {
        await i.deferReply({ flags: 64 });

        const key = await getKey();
        return i.editReply(key ? `Key: \`${key}\`` : "No keys.");
      }

      if (i.commandName === "keys") {
        await i.deferReply({ flags: 64 });
        return renderKeys(i, 0);
      }
    }

    if (i.isButton()) {
      const [dir, pageStr] = i.customId.split("_");
      const page = Number(pageStr);

      await i.deferUpdate();

      if (dir === "next") return renderKeys(i, page + 1);
      if (dir === "prev") return renderKeys(i, page - 1);
    }

    if (i.isStringSelectMenu()) {
      await i.deferReply({ flags: 64 });

      const key = i.values[0];

      const res = await api.get(`/api/admin/key/${key}`);
      const k = res.data;

      const embed = new EmbedBuilder()
        .setTitle("Key")
        .addFields(
          { name: "Key", value: k.key },
          { name: "Status", value: k.used ? "USED" : "FREE" }
        );

      return i.editReply({ embeds: [embed] });
    }
  } catch (err) {
    console.log(err);
  }
});

client.once("clientReady", () => {
  console.log("Bot online");
});

client.login(process.env.TOKEN);
