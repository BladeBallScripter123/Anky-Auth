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
  timeout: 5000,
});

/* ---------------- SAFE REPLY ---------------- */

async function safeReply(i, payload) {
  try {
    if (i.deferred || i.replied) return await i.editReply(payload);
    return await i.reply(payload);
  } catch {
    try {
      return await i.followUp(payload);
    } catch {
      return null;
    }
  }
}

/* ---------------- UI ---------------- */

async function renderKeysUI(i, page = 0) {
  const res = await api.get("/api/admin/keys");
  const keys = res.data || [];

  const start = page * PAGE_SIZE;
  const pageKeys = keys.slice(start, start + PAGE_SIZE);

  const options = pageKeys.map((k) => ({
    label: k.key.slice(0, 25),
    description: k.revoked
      ? "🔴 REVOKED"
      : k.used
      ? "🟠 USED"
      : "🟢 FREE",
    value: k.key,
  }));

  const embed = new EmbedBuilder()
    .setTitle("🔑 Key Manager")
    .setDescription(`Page ${page + 1} • Total ${keys.length}`)
    .setColor(0x2b2d31);

  const menu = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("key_select")
      .setPlaceholder("Select key")
      .addOptions(options.length ? options : [{ label: "No keys", value: "none" }])
  );

  const nav = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`keys_prev_${page}`)
      .setLabel("Prev")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page === 0),

    new ButtonBuilder()
      .setCustomId(`keys_next_${page}`)
      .setLabel("Next")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(start + PAGE_SIZE >= keys.length)
  );

  return safeReply(i, { embeds: [embed], components: [menu, nav], flags: 64 });
}

/* ---------------- GET KEY ---------------- */

async function getKey(user) {
  try {
    const res = await api.get("/api/keys/unused");
    return res.data?.key || null;
  } catch {
    return null;
  }
}

/* ---------------- BOT ---------------- */

client.on("interactionCreate", async (i) => {
  try {
    if (i.isChatInputCommand()) {
      await i.deferReply({ flags: 64 });

      if (i.commandName === "getkey") {
        const key = await getKey(i.user);
        return i.editReply(key ? `Key: \`${key}\`` : "No keys available.");
      }

      if (i.commandName === "keys") {
        return renderKeysUI(i, 0);
      }
    }

    if (i.isStringSelectMenu() && i.customId === "key_select") {
      if (i.values[0] === "none") {
        return safeReply(i, { content: "No keys.", flags: 64 });
      }

      const key = i.values[0];
      const res = await api.get(`/api/admin/key/${key}`);
      const k = res.data;

      const embed = new EmbedBuilder()
        .setTitle("🔑 Key Details")
        .setColor(0x00aaff)
        .addFields(
          { name: "Key", value: `\`${k.key}\`` },
          {
            name: "Status",
            value: k.revoked ? "REVOKED" : k.used ? "USED" : "FREE",
          },
          {
            name: "HWIDs",
            value: k.hwids?.length ? k.hwids.join("\n") : "None",
          }
        );

      return i.update({ embeds: [embed], components: [] });
    }

    if (i.isButton()) {
      const [action, dir, pageStr] = i.customId.split("_");

      if (action === "keys") {
        const page = Number(pageStr) || 0;
        if (dir === "next") return renderKeysUI(i, page + 1);
        if (dir === "prev") return renderKeysUI(i, Math.max(page - 1, 0));
      }
    }
  } catch (err) {
    console.log("ERROR:", err?.message || err);
    safeReply(i, { content: "Error", flags: 64 });
  }
});

/* ---------------- READY ---------------- */

client.once("clientReady", () => {
  console.log("Bot online");
});

client.login(process.env.TOKEN);
