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

/* ---------------- SAFE API WRAPPER ---------------- */

async function apiGet(url: string) {
  return axios.get(url, {
    headers: { "x-admin-secret": process.env.ADMIN_SECRET },
    timeout: 5000,
  });
}

async function apiPost(url: string, data: any) {
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

/* ---------------- GET KEY ---------------- */

async function getKey(user: any) {
  try {
    const res = await axios.get(`${API}/api/keys/unused`, {
      headers: { Authorization: process.env.BOT_SECRET },
      timeout: 5000,
    });

    const key = res.data?.key;
    if (!key) return null;

    await axios.post(
      `${API}/api/keys/assign`,
      {
        key,
        userId: user.id,
        username: user.username,
      },
      { timeout: 5000 }
    );

    return key;
  } catch (err: any) {
    console.log("GETKEY ERROR:", err?.message);
    return null;
  }
}

/* ---------------- INTERACTION HANDLER ---------------- */

client.on("interactionCreate", async (i) => {
  try {
    /* ---------------- SLASH COMMANDS ---------------- */
    if (i.isChatInputCommand()) {
      if (!i.deferred && !i.replied) {
        try {
          await i.deferReply({ flags: 64 });
        } catch {
          return;
        }
      }

      /* GETKEY */
      if (i.commandName === "getkey") {
        const key = await getKey(i.user);

        return i.editReply(
          key ? `Key: \`${key}\`` : "No keys available."
        );
      }

      /* KEYS PANEL */
      if (i.commandName === "keys") {
        const res = await apiGet(`${API}/api/admin/keys`);
        const keys = res.data || [];

        const options = keys.slice(0, 25).map((k: any) => ({
          label: k.key.slice(0, 20),
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
          .setDescription("Select a key to manage it.");

        const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId("key_select")
            .setPlaceholder("Select key")
            .addOptions(options)
        );

        return i.editReply({ embeds: [embed], components: [row] });
      }

      /* ACTIVITY */
      if (i.commandName === "activity") {
        const res = await apiGet(`${API}/api/admin/activity`);
        const logs = res.data || [];

        const embed = new EmbedBuilder()
          .setTitle("📜 Activity")
          .setColor(0x2b2d31)
          .setDescription(
            logs
              .slice(0, 10)
              .map(
                (l: any) =>
                  `**${l.event}**\n\`${l.key ?? "none"}\`\n${l.createdAt}`
              )
              .join("\n\n") || "No activity"
          );

        return i.editReply({ embeds: [embed] });
      }

      /* DASHBOARD */
      if (i.commandName === "dashboard") {
        const res = await apiGet(`${API}/api/admin/stats`);
        const data = res.data || {};

        const percent = data.total
          ? Math.round((data.used / data.total) * 100)
          : 0;

        const embed = new EmbedBuilder()
          .setTitle("📊 Dashboard")
          .setColor(percent > 80 ? 0xff0000 : 0x00ff00)
          .addFields(
            { name: "Total", value: String(data.total ?? 0), inline: true },
            { name: "Used", value: String(data.used ?? 0), inline: true },
            { name: "Unused", value: String(data.unused ?? 0), inline: true },
            { name: "Revoked", value: String(data.revoked ?? 0), inline: true },
            { name: "Usage", value: `${percent}%`, inline: true }
          );

        return i.editReply({ embeds: [embed] });
      }
    }

    /* ---------------- SELECT MENU ---------------- */
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
          .setCustomId(`hwid_${k.key}`)
          .setLabel("HWID")
          .setStyle(ButtonStyle.Secondary),

        new ButtonBuilder()
          .setCustomId(`banhwid_${k.key}`)
          .setLabel("Ban HWID")
          .setStyle(ButtonStyle.Danger)
      );

      return i.update({ embeds: [embed], components: [row] });
    }

    /* ---------------- BUTTONS ---------------- */
    if (i.isButton()) {
      const [action, key] = i.customId.split("_");

      if (action === "copy") {
        return i.reply({ content: `\`${key}\``, flags: 64 });
      }

      if (action === "revoke") {
        await apiPost(`${API}/api/admin/revoke`, { key });
        return i.reply({ content: "Updated.", flags: 64 });
      }

      if (action === "delete") {
        await apiDelete(`${API}/api/admin/key/${key}`);
        return i.reply({ content: "Deleted.", flags: 64 });
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
        return i.reply({ content: "HWID banned.", flags: 64 });
      }
    }
  } catch (err: any) {
    console.log("BOT ERROR:", err?.message);

    try {
      if (i.isRepliable() && !i.replied) {
        await i.reply({ content: "Error occurred.", flags: 64 });
      }
    } catch {}
  }
});

/* ---------------- READY ---------------- */

client.once("clientReady", () => {
  console.log("Bot online");
});

client.login(process.env.TOKEN);
