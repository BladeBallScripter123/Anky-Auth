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
});

/* ---------------- SAFE REPLY ---------------- */

async function reply(i, data) {
  if (i.replied || i.deferred) return i.editReply(data);
  return i.reply(data);
}

/* ---------------- VALIDATE KEY ---------------- */

function cleanKey(k) {
  if (!k) return null;
  k = k.trim().toUpperCase();
  if (k.length > 34) k = k.slice(0, 34);
  return /^[A-Z0-9]{6}(-[A-Z0-9]{6}){4}$/.test(k) ? k : null;
}

/* ---------------- RENDER ---------------- */

async function render(i, page = 0) {
  const res = await api.get("/api/admin/keys");
  const keys = res.data;

  const start = page * PAGE_SIZE;
  const slice = keys.slice(start, start + PAGE_SIZE);

  const embed = new EmbedBuilder()
    .setTitle("🔑 Key Manager")
    .setDescription(`Page ${page + 1} • Total ${keys.length}`);

  const menu = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("select")
      .addOptions(
        slice.map((k) => ({
          label: k.key,
          value: k.key,
          description: k.used ? "USED" : "FREE",
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

  return reply(i, {
    embeds: [embed],
    components: [menu, nav],
    flags: 64,
  });
}

/* ---------------- GET KEY ---------------- */

async function getKey() {
  try {
    const res = await axios.get(`${API}/api/keys/unused`);
    return res.data.key;
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
        return render(i, 0);
      }
    }

    if (i.isButton()) {
      const [dir, pageStr] = i.customId.split("_");
      const page = Number(pageStr);

      await i.deferUpdate();

      if (dir === "next") return render(i, page + 1);
      if (dir === "prev") return render(i, page - 1);
    }

    if (i.isStringSelectMenu()) {
      await i.deferReply({ flags: 64 });

      const key = cleanKey(i.values[0]);

      if (!key) {
        return i.editReply("Invalid key");
      }

      try {
        const res = await api.get(`/api/admin/key/${key}`);
        const k = res.data;

        const embed = new EmbedBuilder()
          .setTitle("Key Info")
          .addFields(
            { name: "Key", value: k.key },
            { name: "Status", value: k.used ? "USED" : "FREE" }
          );

        return i.editReply({ embeds: [embed] });
      } catch {
        return i.editReply("Key not found");
      }
    }
  } catch (e) {
    console.log("ERR", e);
  }
});

client.once("clientReady", () => {
  console.log("Bot online");
});

client.login(process.env.TOKEN);
