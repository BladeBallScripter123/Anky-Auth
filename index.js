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

/* ---------------- HELPERS ---------------- */

function encodeKey(key) {
  return Buffer.from(key).toString("base64");
}

function decodeKey(encoded) {
  return Buffer.from(encoded, "base64").toString("utf8");
}

async function apiGet(url) {
  return axios.get(`${API}${url}`, {
    headers: { "x-admin-secret": process.env.ADMIN_SECRET },
    timeout: 5000,
  });
}

async function apiPost(url, data) {
  return axios.post(`${API}${url}`, data, {
    headers: { "x-admin-secret": process.env.ADMIN_SECRET },
    timeout: 5000,
  });
}

async function apiDelete(url) {
  return axios.delete(`${API}${url}`, {
    headers: { "x-admin-secret": process.env.ADMIN_SECRET },
    timeout: 5000,
  });
}

async function safeReply(i, payload) {
  try {
    if (i.replied || i.deferred) return await i.editReply(payload);
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
  const res = await apiGet("/api/admin/keys");
  const keys = Array.isArray(res.data) ? res.data : [];

  const start = page * PAGE_SIZE;
  const pageKeys = keys.slice(start, start + PAGE_SIZE);

  const options = pageKeys.slice(0, 25).map((k) => ({
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
    .setColor(0x2b2d31)
    .setDescription(`Page ${page + 1} • Total ${keys.length}`);

  const menu = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("key_select")
      .setPlaceholder("Select key")
      .addOptions(
        options.length ? options : [{ label: "No keys", value: "none" }]
      )
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
    const res = await axios.get(`${API}/api/keys/unused`);
    return res.data?.key || null;
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
        return safeReply(i, {
          content: key ? `Key: \`${key}\`` : "No keys available.",
        });
      }

      if (i.commandName === "keys") {
        return renderKeysUI(i, 0);
      }
    }

    /* SELECT MENU */
    if (i.isStringSelectMenu() && i.customId === "key_select") {
      if (i.values[0] === "none") {
        return safeReply(i, { content: "No keys.", flags: 64 });
      }

      const key = i.values[0];
      const res = await apiGet(`/api/admin/key/${key}`);
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
          { name: "HWID", value: k.hwid || "None" }
        );

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`copy_${encodeKey(k.key)}`)
          .setLabel("Copy")
          .setStyle(ButtonStyle.Primary),

        new ButtonBuilder()
          .setCustomId(`revoke_${encodeKey(k.key)}`)
          .setLabel("Revoke")
          .setStyle(ButtonStyle.Danger),

        new ButtonBuilder()
          .setCustomId(`delete_${encodeKey(k.key)}`)
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
      const id = i.customId;

      if (id === "back_keys") {
        return renderKeysUI(i, 0);
      }

      const [action, encoded] = id.split("_");
      const key = decodeKey(encoded);

      if (action === "copy") {
        return safeReply(i, { content: `\`${key}\``, flags: 64 });
      }

      if (action === "revoke") {
        await apiPost("/api/admin/revoke", { key });
        return safeReply(i, { content: "Revoked", flags: 64 });
      }

      if (action === "delete") {
        await apiDelete(`/api/admin/key/${key}`);
        return safeReply(i, { content: "Deleted", flags: 64 });
      }

      /* pagination */
      if (action === "keys") {
        const dir = encoded;
        const page = Number(id.split("_")[2]) || 0;

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
