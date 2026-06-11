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

/* ---------------- API ---------------- */

const api = axios.create({
  baseURL: API,
  timeout: 5000,
  headers: { "x-admin-secret": ADMIN },
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

/* ---------------- GET KEY ---------------- */

async function getKey(user) {
  try {
    const res = await axios.get(`${API}/api/keys/unused`);
    const key = res.data?.key;
    if (!key) return null;
    return key;
  } catch {
    return null;
  }
}

/* ---------------- RENDER UI ---------------- */

async function renderKeysUI(i, page = 0) {
  const res = await api.get("/api/admin/keys");
  const keys = Array.isArray(res.data) ? res.data : [];

  const PAGE_SIZE = 10;
  const start = page * PAGE_SIZE;
  const pageKeys = keys.slice(start, start + PAGE_SIZE);

  const embed = new EmbedBuilder()
    .setTitle("🔑 Key Manager")
    .setColor(0x2b2d31)
    .setDescription(
      `Page ${page + 1} • Total ${keys.length}\n\n` +
      pageKeys
        .map((k) => {
          const hw = k.hwids?.length ? k.hwids.join(", ") : "None";
          return `**${k.key}**\nStatus: ${
            k.revoked ? "REVOKED" : k.used ? "USED" : "FREE"
          }\nHWID: \`${hw.slice(0, 80)}\`\n`;
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

  // IMPORTANT FIX: ALWAYS UPDATE, NEVER REPLY AGAIN
  if (i.update) {
    return i.update({
      embeds: [embed],
      components: [menu, nav],
    });
  }

  return i.editReply({
    embeds: [embed],
    components: [menu, nav],
  });
}

/* ---------------- BOT ---------------- */

client.on("interactionCreate", async (i) => {
  try {
    /* ---------- COMMANDS ---------- */
    if (i.isChatInputCommand()) {
      if (!i.deferred && !i.replied) {
        await i.deferReply({ flags: 64 });
      }

      if (i.commandName === "getkey") {
        const key = await getKey(i.user);
        return safeReply(i, {
          content: key ? `Key: \`${key}\`` : "No keys available",
        });
      }

      if (i.commandName === "keys") {
        return renderKeysUI(i, 0);
      }
    }

    /* ---------- SELECT ---------- */
    if (i.isStringSelectMenu() && i.customId === "key_select") {
      if (i.values[0] === "none") {
        return safeReply(i, { content: "No keys", flags: 64 });
      }

      const key = i.values[0];

      const res = await api.get(`/api/admin/key/${key}`);
      const k = res.data;

      const embed = new EmbedBuilder()
        .setTitle("Key Info")
        .setColor(0x00aaff)
        .addFields(
          { name: "Key", value: `\`${k.key}\`` },
          {
            name: "Status",
            value: k.revoked
              ? "REVOKED"
              : k.used
              ? "USED"
              : "FREE",
          },
          {
            name: "HWIDs",
            value:
              k.hwids?.length > 0
                ? k.hwids.join("\n")
                : "None",
          }
        );

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`copy_${k.key}`)
          .setLabel("Copy")
          .setStyle(ButtonStyle.Primary),

        new ButtonBuilder()
          .setCustomId(`revoke_${k.key}`)
          .setLabel("Revoke")
          .setStyle(ButtonStyle.Danger),

        new ButtonBuilder()
          .setCustomId(`delete_${k.key}`)
          .setLabel("Delete")
          .setStyle(ButtonStyle.Danger),

        new ButtonBuilder()
          .setCustomId("back")
          .setLabel("Back")
          .setStyle(ButtonStyle.Secondary)
      );

      return i.update({ embeds: [embed], components: [row] });
    }

    /* ---------- BUTTONS ---------- */
    if (i.isButton()) {
      const [action, ...rest] = i.customId.split("_");
      const key = rest.join("_");

      if (action === "back") return renderKeysUI(i, 0);

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
        const dir = rest[0];
        const page = Number(rest[1]) || 0;

        if (dir === "next") return renderKeysUI(i, page + 1);
        if (dir === "prev") return renderKeysUI(i, Math.max(page - 1, 0));
      }
    }
  } catch (err) {
    console.log("ERROR:", err?.message || err);
    return safeReply(i, { content: "Error", flags: 64 });
  }
});

/* ---------------- READY ---------------- */

client.once("clientReady", () => {
  console.log("Bot online");
});

client.login(process.env.TOKEN);
