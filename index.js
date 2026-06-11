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

const API = process.env.API_URL!;
const ADMIN = process.env.ADMIN_SECRET!;

const PAGE_SIZE = 10;

/* ---------------- SAFE API ---------------- */

const api = axios.create({
  baseURL: API,
  timeout: 8000,
  headers: {
    "x-admin-secret": ADMIN,
  },
});

/* ---------------- SAFE SORT ---------------- */

function sortKeys(keys: any[]) {
  return keys.sort((a, b) => {
    const aMulti = (a.hwidCount || 0) > 1 ? 0 : 1;
    const bMulti = (b.hwidCount || 0) > 1 ? 0 : 1;

    if (aMulti !== bMulti) return aMulti - bMulti;
    if (a.used !== b.used) return b.used - a.used;
    return (a.revoked ? 1 : 0) - (b.revoked ? 1 : 0);
  });
}

/* ---------------- KEY UI (SAFE) ---------------- */

async function renderKeysUI(i: any, page = 0) {
  const res = await api.get("/api/admin/keys").catch(() => null);

  let keys = Array.isArray(res?.data) ? res.data : [];

  if (!keys.length) {
    const embed = new EmbedBuilder()
      .setTitle("🔑 Key Manager")
      .setColor(0x2b2d31)
      .setDescription("No keys returned from backend.");

    return i.reply?.({ embeds: [embed], flags: 64 });
  }

  keys = sortKeys(keys);

  const start = page * PAGE_SIZE;
  const pageKeys = keys.slice(start, start + PAGE_SIZE);

  const options = pageKeys.map((k: any) => ({
    label: (k.key || "UNKNOWN").slice(0, 25),
    description: k.revoked
      ? "REVOKED"
      : (k.hwidCount || 0) > 1
      ? `⚠ MULTI HWID (${k.hwidCount})`
      : k.used
      ? "USED"
      : "FREE",
    value: k.key,
  }));

  const embed = new EmbedBuilder()
    .setTitle("🔑 Key Manager")
    .setColor(0x2b2d31)
    .setDescription(
      `Page ${page + 1}\nTotal: ${keys.length}\n\nMulti-HWID → Used → Free`
    );

  const menu = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`keys_select_${page}`)
      .setPlaceholder("Select key")
      .addOptions(
        options.length
          ? options
          : [{ label: "No keys", value: "none" }]
      )
  );

  const nav = new ActionRowBuilder<ButtonBuilder>().addComponents(
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

  if (i.isChatInputCommand()) {
    return i.editReply({ embeds: [embed], components: [menu, nav] });
  }

  return i.update?.({ embeds: [embed], components: [menu, nav] });
}

/* ---------------- GET KEY (UNCHANGED SAFE) ---------------- */

async function getKey(user: any) {
  try {
    const res = await api.get("/api/keys/unused", {
      headers: { Authorization: process.env.BOT_SECRET },
    });

    const key = res.data?.key;
    if (!key) return null;

    await api.post("/api/keys/assign", {
      key,
      userId: user.id,
      username: user.username,
    });

    return key;
  } catch {
    return null;
  }
}

/* ---------------- BOT ---------------- */

client.on("interactionCreate", async (i) => {
  try {
    /* COMMANDS */
    if (i.isChatInputCommand()) {
      await i.deferReply({ flags: 64 });

      if (i.commandName === "getkey") {
        const key = await getKey(i.user);
        return i.editReply(key ? `\`${key}\`` : "No keys available.");
      }

      if (i.commandName === "keys") {
        return renderKeysUI(i, 0);
      }

      /* IMPORTANT: DO NOT BREAK OTHER COMMANDS */
      if (i.commandName === "dashboard") {
        return i.editReply("Dashboard endpoint not supported in this bot version.");
      }

      if (i.commandName === "activity") {
        return i.editReply("Activity endpoint not supported in this bot version.");
      }
    }

    /* SELECT MENU */
    if (i.isStringSelectMenu()) {
      if (i.values[0] === "none") {
        return i.reply({ content: "No keys.", flags: 64 });
      }

      const key = i.values[0];

      const res = await api
        .get(`/api/admin/key/${key}`)
        .catch(() => null);

      const k = res?.data;

      if (!k) {
        return i.reply({ content: "Key not found", flags: 64 });
      }

      const embed = new EmbedBuilder()
        .setTitle("🔑 Key Details")
        .setColor((k.hwidCount || 0) > 1 ? 0xff0000 : 0x00aaff)
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
          { name: "HWID", value: k.hwid || "None" },
          { name: "HWID COUNT", value: String(k.hwidCount || 0) }
        );

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
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
          .setCustomId("back_keys")
          .setLabel("Back")
          .setStyle(ButtonStyle.Secondary)
      );

      return i.update({ embeds: [embed], components: [row] });
    }

    /* BUTTONS */
    if (i.isButton()) {
      const parts = i.customId.split("_");

      if (i.customId === "back_keys") {
        return renderKeysUI(i, 0);
      }

      const action = parts[0];
      const key = parts.slice(1).join("_");

      if (action === "copy") {
        return i.reply({ content: `\`${key}\``, flags: 64 });
      }

      if (action === "revoke") {
        await api.post("/api/admin/revoke", { key }).catch(() => {});
        return i.reply({ content: "Revoked", flags: 64 });
      }

      if (action === "delete") {
        await api.delete(`/api/admin/key/${key}`).catch(() => {});
        return i.reply({ content: "Deleted", flags: 64 });
      }
    }
  } catch (err) {
    console.log("BOT ERROR:", err);

    if (!i.replied) {
      try {
        await i.reply({ content: "Error", flags: 64 });
      } catch {}
    }
  }
});

/* ---------------- READY ---------------- */

client.once("clientReady", () => {
  console.log("Bot online");
});

client.login(process.env.TOKEN);
