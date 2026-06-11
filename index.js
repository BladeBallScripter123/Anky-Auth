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
const ADMIN = process.env.ADMIN_SECRET;

const PAGE_SIZE = 10;

/* ---------------- API CLIENT ---------------- */

const api = axios.create({
  baseURL: API,
  timeout: 5000,
  headers: { "x-admin-secret": ADMIN },
});

/* ---------------- SAFE REPLY ---------------- */

async function safeReply(i, payload) {
  try {
    if (i.deferred || i.replied) return await i.followUp(payload);
    return await i.reply(payload);
  } catch {
    try {
      return await i.followUp(payload);
    } catch {
      return null;
    }
  }
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

/* ---------------- RENDER UI ---------------- */

async function renderKeysUI(i, page = 0) {
  const res = await api.get("/api/admin/keys");
  const keys = Array.isArray(res.data) ? res.data : [];

  const start = page * PAGE_SIZE;
  const pageKeys = keys.slice(start, start + PAGE_SIZE);

  const embed = new EmbedBuilder()
    .setTitle("🔑 Key Manager")
    .setColor(0x2b2d31)
    .setDescription(
      `Page ${page + 1} • Total ${keys.length}\n\n` +
        pageKeys
          .map((k) => {
            const hw = k.hwid || "None";
            return `**${k.key}**\nStatus: ${
              k.revoked ? "REVOKED" : k.used ? "USED" : "FREE"
            }\nHWID: \`${hw}\`\n`;
          })
          .join("\n")
    );

  const menu = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("key_select")
      .setPlaceholder("Select key")
      .addOptions(
        pageKeys.map((k) => ({
          label: k.key.slice(0, 25),
          value: k.key,
        }))
      )
  );

  const nav = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`page_prev_${page}`)
      .setLabel("Prev")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page === 0),

    new ButtonBuilder()
      .setCustomId(`page_next_${page}`)
      .setLabel("Next")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(start + PAGE_SIZE >= keys.length)
  );

  if (i.update) {
    return i.update({ embeds: [embed], components: [menu, nav] });
  }

  return i.editReply({ embeds: [embed], components: [menu, nav] });
}

/* ---------------- BOT ---------------- */

client.on("interactionCreate", async (i) => {
  try {
    /* ---------------- COMMANDS ---------------- */

    if (i.isChatInputCommand()) {
      if (!i.deferred && !i.replied) {
        await i.deferReply({ flags: 64 });
      }

      if (i.commandName === "getkey") {
        const key = await getKey();
        return safeReply(i, {
          content: key ? `Key: \`${key}\`` : "No keys available",
        });
      }

      if (i.commandName === "keys") {
        return renderKeysUI(i, 0);
      }
    }

    /* ---------------- SELECT MENU ---------------- */

    if (i.isStringSelectMenu() && i.customId === "key_select") {
      const key = i.values?.[0];
      if (!key) return;

      const res = await api.get(`/api/admin/key/${key}`);
      const k = res.data;

      const embed = new EmbedBuilder()
        .setTitle("Key Info")
        .setColor(0x00aaff)
        .addFields(
          { name: "Key", value: `\`${k.key}\`` },
          {
            name: "Status",
            value: k.revoked ? "REVOKED" : k.used ? "USED" : "FREE",
          },
          {
            name: "HWID",
            value: k.hwid || "None",
          }
        );

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`copy:${k.key}`)
          .setLabel("Copy")
          .setStyle(ButtonStyle.Primary),

        new ButtonBuilder()
          .setCustomId(`revoke:${k.key}`)
          .setLabel("Revoke")
          .setStyle(ButtonStyle.Danger),

        new ButtonBuilder()
          .setCustomId(`delete:${k.key}`)
          .setLabel("Delete")
          .setStyle(ButtonStyle.Danger),

        new ButtonBuilder()
          .setCustomId("back")
          .setLabel("Back")
          .setStyle(ButtonStyle.Secondary)
      );

      return i.update({ embeds: [embed], components: [row] });
    }

    /* ---------------- BUTTONS ---------------- */

    if (i.isButton()) {
      const [action, keyRaw] = i.customId.split(":");
      const key = keyRaw || "";

      if (action === "back") {
        if (!i.deferred && !i.replied) await i.deferUpdate();
        return renderKeysUI(i, 0);
      }

      if (action === "copy") {
        return safeReply(i, { content: `\`${key}\``, flags: 64 });
      }

      if (action === "revoke") {
        await api.post("/api/admin/revoke", { key });
        return safeReply(i, { content: "Revoked", flags: 64 });
      }

      if (action === "delete") {
        await api.delete(`/api/admin/key/${key}`);
        return safeReply(i, { content: "Deleted", flags: 64 });
      }

      if (action === "page") {
        const dir = keyRaw;
        const currentPage = Number(dir) || 0;

        return renderKeysUI(i, currentPage);
      }
    }
  } catch (err) {
    console.log("BOT ERROR:", err?.response?.data || err.message);
    return safeReply(i, { content: "Error occurred", flags: 64 });
  }
});

/* ---------------- READY ---------------- */

client.once("clientReady", () => {
  console.log("Bot online");
});

client.login(process.env.TOKEN);
