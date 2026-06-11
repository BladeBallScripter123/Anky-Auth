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

/* ---------------- API ---------------- */

async function apiGet(url) {
  return axios.get(url, {
    headers: { "x-admin-secret": process.env.ADMIN_SECRET },
    timeout: 5000,
  });
}

async function apiPost(url, data) {
  return axios.post(url, data, {
    headers: { "x-admin-secret": process.env.ADMIN_SECRET },
    timeout: 5000,
  });
}

async function apiDelete(url) {
  return axios.delete(url, {
    headers: { "x-admin-secret": process.env.ADMIN_SECRET },
    timeout: 5000,
  });
}

/* ---------------- STATE ---------------- */

const PAGE_SIZE = 10;

/* ---------------- KEY UI ---------------- */

async function renderKeysUI(i, page = 0) {
  const res = await apiGet(`${API}/api/admin/keys`);
  const keys = res.data || [];

  const start = page * PAGE_SIZE;
  const pageKeys = keys.slice(start, start + PAGE_SIZE);

  const options = pageKeys.map((k) => ({
    label: k.key.slice(0, 25),
    description: k.revoked
      ? "REVOKED"
      : k.used
      ? "USED"
      : "FREE",
    value: k.key,
  }));

  const embed = new EmbedBuilder()
    .setTitle("🔑 Key Manager")
    .setColor(0x2b2d31)
    .setDescription(
      `Page **${page + 1}**\nTotal: **${keys.length}**`
    );

  const row = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("key_select")
      .setPlaceholder("Select key")
      .addOptions(options.length ? options : [
        { label: "No keys", value: "none" }
      ])
  );

  const nav = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`keys_prev_${page}`)
      .setLabel("⬅ Prev")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page === 0),

    new ButtonBuilder()
      .setCustomId(`keys_next_${page}`)
      .setLabel("Next ➡")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(start + PAGE_SIZE >= keys.length)
  );

  return i.update({ embeds: [embed], components: [row, nav] });
}

/* ---------------- GET KEY ---------------- */

async function getKey(user) {
  try {
    const res = await axios.get(`${API}/api/keys/unused`, {
      headers: { Authorization: process.env.BOT_SECRET },
      timeout: 5000,
    });

    const key = res.data?.key;
    if (!key) return null;

    await axios.post(`${API}/api/keys/assign`, {
      key,
      userId: user.id,
      username: user.username,
    });

    return key;
  } catch (e) {
    return null;
  }
}

/* ---------------- BOT ---------------- */

client.on("interactionCreate", async (i) => {
  try {
    /* ---------------- COMMANDS ---------------- */
    if (i.isChatInputCommand()) {
      if (!i.deferred) await i.deferReply({ flags: 64 });

      if (i.commandName === "getkey") {
        const key = await getKey(i.user);
        return i.editReply(key ? `Key: \`${key}\`` : "No keys available.");
      }

      if (i.commandName === "keys") {
        return renderKeysUI(i, 0);
      }
    }

    /* ---------------- SELECT KEY ---------------- */
    if (i.isStringSelectMenu() && i.customId === "key_select") {
      const key = i.values[0];

      const res = await apiGet(`${API}/api/admin/key/${key}`);
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
          .setCustomId(`hwid_${k.key}`)
          .setLabel("HWID")
          .setStyle(ButtonStyle.Secondary),

        new ButtonBuilder()
          .setCustomId(`banhwid_${k.key}`)
          .setLabel("Ban HWID")
          .setStyle(ButtonStyle.Danger),

        new ButtonBuilder()
          .setCustomId("back_keys")
          .setLabel("Back")
          .setStyle(ButtonStyle.Secondary)
      );

      return i.update({ embeds: [embed], components: [row] });
    }

    /* ---------------- NAVIGATION ---------------- */
    if (i.isButton()) {
      const [action, key, page] = i.customId.split("_");

      /* BACK */
      if (i.customId === "back_keys") {
        return renderKeysUI(i, 0);
      }

      /* PAGINATION */
      if (action === "keys") {
        const pageNum = parseInt(page);

        if (key === "next") {
          return renderKeysUI(i, pageNum + 1);
        }

        if (key === "prev") {
          return renderKeysUI(i, Math.max(pageNum - 1, 0));
        }
      }

      /* KEY ACTIONS */
      if (action === "copy") {
        return i.reply({ content: `\`${key}\``, flags: 64 });
      }

      if (action === "revoke") {
        await apiPost(`${API}/api/admin/revoke`, { key });
        return i.reply({ content: "Updated", flags: 64 });
      }

      if (action === "delete") {
        await apiDelete(`${API}/api/admin/key/${key}`);
        return i.reply({ content: "Deleted", flags: 64 });
      }

      if (action === "hwid") {
        const res = await apiGet(`${API}/api/admin/key/${key}`);
        return i.reply({
          content: `HWID: \`${res.data.hwid || "None"}\``,
          flags: 64,
        });
      }

      if (action === "banhwid") {
        await apiPost(`${API}/api/admin/ban-hwid`, { key });
        return i.reply({ content: "HWID banned", flags: 64 });
      }
    }
  } catch (err) {
    console.log("ERROR:", err.message);

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
