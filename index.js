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
const PAGE_SIZE = 10;

/* ---------------- API ---------------- */

async function apiGet(url: string) {
  return axios.get(url, {
    headers: { "x-admin-secret": process.env.ADMIN_SECRET },
    timeout: 5000,
  });
}

async function apiPost(url: string, data?: any) {
  return axios.post(url, data, {
    headers: { "x-admin-secret": process.env.ADMIN_SECRET },
    timeout: 5000,
  });
}

async function apiDelete(url: string) {
  return axios.delete(url, {
    headers: { "x-admin-secret": process.env.ADMIN_SECRET },
    timeout: 5000,
  });
}

/* ---------------- SAFE INTERACTION HANDLER ---------------- */

async function safeReply(i: any, payload: any) {
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

/* ---------------- KEY HIERARCHY SORT ---------------- */

function sortKeys(keys: any[]) {
  return [...keys].sort((a, b) => {
    const score = (k: any) => {
      const hwidCount = k.hwidCount || 0;
      if (hwidCount >= 2) return 0; // multi HWID first
      if (k.used) return 1;        // used second
      return 2;                    // free last
    };
    return score(a) - score(b);
  });
}

/* ---------------- KEY LIST UI ---------------- */

async function renderKeysUI(i: any, page = 0) {
  const res = await apiGet(`${API}/api/admin/keys`);
  const rawKeys = Array.isArray(res.data) ? res.data : [];

  const keys = sortKeys(rawKeys);

  const start = page * PAGE_SIZE;
  const pageKeys = keys.slice(start, start + PAGE_SIZE);

  const options = pageKeys.slice(0, 25).map((k) => ({
    label: (k.key || "UNKNOWN").slice(0, 25),
    description:
      (k.hwidCount || 0) >= 2
        ? `🔴 MULTI HWID (${k.hwidCount})`
        : k.used
        ? "🟠 USED"
        : "🟢 FREE",
    value: k.key,
  }));

  const embed = new EmbedBuilder()
    .setTitle("🔑 Key Manager")
    .setColor(0x2b2d31)
    .setDescription(
      `Page ${page + 1} • Total ${keys.length}\n\n🔴 Multi-HWID → 🟠 Used → 🟢 Free`
    );

  const menu = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("key_select")
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

  if (i.deferred || i.replied) {
    return i.editReply({ embeds: [embed], components: [menu, nav] });
  }

  return i.reply({ embeds: [embed], components: [menu, nav], flags: 64 });
}

/* ---------------- GET KEY ---------------- */

async function getKey(user: any) {
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
  } catch {
    return null;
  }
}

/* ---------------- INTERACTIONS ---------------- */

client.on("interactionCreate", async (i) => {
  try {
    /* COMMANDS */
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

    /* SELECT KEY */
    if (i.isStringSelectMenu() && i.customId === "key_select") {
      if (i.values[0] === "none") {
        return safeReply(i, { content: "No keys.", flags: 64 });
      }

      const key = i.values[0];
      const res = await apiGet(`${API}/api/admin/key/${key}`);
      const k = res.data;

      const hwids = k.hwids || [];
      const hwidText =
        hwids.length > 0
          ? hwids.join("\n")
          : k.hwid || "None";

      const embed = new EmbedBuilder()
        .setTitle("🔑 Key Details")
        .setColor((k.hwidCount || 0) >= 2 ? 0xff0000 : 0x00aaff)
        .addFields(
          { name: "Key", value: `\`${k.key}\`` },
          {
            name: "Status",
            value: k.revoked ? "REVOKED" : k.used ? "USED" : "FREE",
          },
          { name: "HWIDs", value: hwidText },
          { name: "HWID Count", value: String(k.hwidCount || 0) }
        );

      const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
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

      const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`hwid_${k.key}`)
          .setLabel("HWID")
          .setStyle(ButtonStyle.Secondary),

        new ButtonBuilder()
          .setCustomId(`banhwid_${k.key}`)
          .setLabel("Ban HWID")
          .setStyle(ButtonStyle.Danger)
      );

      return i.update({ embeds: [embed], components: [row1, row2] });
    }

    /* BUTTONS */
    if (i.isButton()) {
      const id = i.customId;

      if (id === "back_keys") {
        return renderKeysUI(i, 0);
      }

      const parts = id.split("_");
      const action = parts[0];
      const key = parts.slice(1).join("_");

      if (action === "copy")
        return safeReply(i, { content: `\`${key}\``, flags: 64 });

      if (action === "revoke") {
        await apiPost(`${API}/api/admin/revoke`, { key });
        return safeReply(i, { content: "Updated", flags: 64 });
      }

      if (action === "delete") {
        await apiDelete(`${API}/api/admin/key/${key}`);
        return safeReply(i, { content: "Deleted", flags: 64 });
      }

      if (action === "hwid") {
        const res = await apiGet(`${API}/api/admin/key/${key}`);
        return safeReply(i, {
          content: `HWIDs:\n\`${(res.data.hwids || []).join("\n") || "None"}\``,
          flags: 64,
        });
      }

      if (action === "banhwid") {
        await apiPost(`${API}/api/admin/ban-hwid`, { key });
        return safeReply(i, { content: "Done", flags: 64 });
      }

      /* pagination */
      if (action === "keys") {
        const dir = parts[1];
        const page = Number(parts[2]) || 0;

        if (dir === "next") return renderKeysUI(i, page + 1);
        if (dir === "prev") return renderKeysUI(i, Math.max(page - 1, 0));
      }
    }
  } catch (err: any) {
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
