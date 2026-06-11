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

async function apiGet(url) {
  return axios.get(url, {
    headers: { "x-admin-secret": process.env.ADMIN_SECRET },
    timeout: 8000,
  });
}

async function apiPost(url, data) {
  return axios.post(url, data, {
    headers: { "x-admin-secret": process.env.ADMIN_SECRET },
    timeout: 8000,
  });
}

async function apiDelete(url) {
  return axios.delete(url, {
    headers: { "x-admin-secret": process.env.ADMIN_SECRET },
    timeout: 8000,
  });
}

/* ---------------- UI RENDER ---------------- */

async function renderKeysUI(i, page = 0) {
  const res = await apiGet(`${API}/api/admin/keys`);
  const keys = Array.isArray(res.data) ? res.data : [];

  const start = page * PAGE_SIZE;
  const pageKeys = keys.slice(start, start + PAGE_SIZE);

  const options = pageKeys.length
    ? pageKeys.slice(0, 25).map((k) => ({
        label: k.key.slice(0, 25),
        description: k.suspicious
          ? `⚠ MULTI HWID (${k.hwidCount})`
          : k.used
          ? "USED"
          : "FREE",
        value: k.key,
      }))
    : [
        {
          label: "No keys",
          value: "none",
          description: "empty",
        },
      ];

  const embed = new EmbedBuilder()
    .setTitle("🔑 Key Manager")
    .setColor(0x2b2d31)
    .setDescription(
      `Page ${page + 1} • Total ${keys.length}\n\n` +
        `⚠ Multi-HWID = abuse detection`
    );

  const menuRow = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`key_select_${page}`)
      .setPlaceholder("Select key")
      .addOptions(options)
  );

  const navRow = new ActionRowBuilder().addComponents(
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

  if (i.deferred || i.replied) {
    return i.editReply({ embeds: [embed], components: [menuRow, navRow] });
  }

  return i.reply({
    embeds: [embed],
    components: [menuRow, navRow],
    flags: 64,
  });
}

/* ---------------- GET KEY ---------------- */

async function getKey(user) {
  try {
    const res = await axios.get(`${API}/api/keys/unused`, {
      headers: { Authorization: process.env.BOT_SECRET },
      timeout: 8000,
    });

    const key = res.data?.key;
    if (!key) return null;

    await axios.post(`${API}/api/keys/assign`, {
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
    /* ---------------- SLASH COMMANDS ---------------- */

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

    /* ---------------- SELECT MENU ---------------- */

    if (i.isStringSelectMenu()) {
      await i.deferUpdate();

      if (i.values[0] === "none") {
        return i.editReply("No keys.");
      }

      const key = i.values[0];

      const res = await apiGet(`${API}/api/admin/key/${key}`);
      const k = res.data;

      const embed = new EmbedBuilder()
        .setTitle("🔑 Key Details")
        .setColor(k.suspicious ? 0xff0000 : 0x00aaff)
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
            value: k.hwids?.length
              ? k.hwids.join("\n")
              : "None",
          },
          {
            name: "HWID Count",
            value: String(k.hwidCount || 0),
          }
        );

      const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`copy_${key}`)
          .setLabel("Copy")
          .setStyle(ButtonStyle.Primary),

        new ButtonBuilder()
          .setCustomId(`revoke_${key}`)
          .setLabel("Revoke")
          .setStyle(ButtonStyle.Danger),

        new ButtonBuilder()
          .setCustomId(`delete_${key}`)
          .setLabel("Delete")
          .setStyle(ButtonStyle.Danger),

        new ButtonBuilder()
          .setCustomId(`back_keys`)
          .setLabel("Back")
          .setStyle(ButtonStyle.Secondary)
      );

      const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`hwid_${key}`)
          .setLabel("HWID")
          .setStyle(ButtonStyle.Secondary),

        new ButtonBuilder()
          .setCustomId(`banhwid_${key}`)
          .setLabel("Ban HWID")
          .setStyle(ButtonStyle.Danger)
      );

      return i.editReply({ embeds: [embed], components: [row1, row2] });
    }

    /* ---------------- BUTTONS ---------------- */

    if (i.isButton()) {
      await i.deferUpdate();

      const parts = i.customId.split("_");

      if (i.customId === "back_keys") {
        return renderKeysUI(i, 0);
      }

      if (parts[0] === "keys") {
        const dir = parts[1];
        const page = Number(parts[2]) || 0;

        if (dir === "next") return renderKeysUI(i, page + 1);
        if (dir === "prev") return renderKeysUI(i, Math.max(page - 1, 0));
      }

      const action = parts[0];
      const key = parts.slice(1).join("_");

      if (action === "copy")
        return i.followUp({ content: `\`${key}\``, flags: 64 });

      if (action === "revoke") {
        await apiPost(`${API}/api/admin/revoke`, { key });
        return i.followUp({ content: "Updated", flags: 64 });
      }

      if (action === "delete") {
        await apiDelete(`${API}/api/admin/key/${key}`);
        return i.followUp({ content: "Deleted", flags: 64 });
      }

      if (action === "hwid") {
        const res = await apiGet(`${API}/api/admin/key/${key}`);
        return i.followUp({
          content: `HWIDs:\n${(res.data.hwids || []).join("\n") || "None"}`,
          flags: 64,
        });
      }

      if (action === "banhwid") {
        await apiPost(`${API}/api/admin/ban-hwid`, { key });
        return i.followUp({ content: "HWID banned", flags: 64 });
      }
    }
  } catch (err) {
    console.log("ERROR:", err?.message || err);

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
