import {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import axios from "axios";

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

const API = process.env.API_URL;

async function getKey(user) {
  try {
    const url = `${process.env.API_URL}/api/keys/unused`;

    console.log("Hitting:", url);

    const res = await axios.get(url, {
      headers: { Authorization: process.env.BOT_SECRET },
      timeout: 5000,
    });

    console.log("Response:", res.data);

    const key = res.data?.key;
    if (!key) return null;

    return key;
  } catch (err) {
    console.log("GETKEY ERROR:", err.response?.status, err.response?.data || err.message);
    return null;
  }
}

function buildKeysEmbed(keys, page, totalPages) {
  return new EmbedBuilder()
    .setTitle("🔑 Key Dashboard")
    .setColor(0x2b2d31)
    .setFooter({ text: `Page ${page + 1} / ${totalPages}` })
    .setTimestamp()
    .setDescription(
      keys.length
        ? keys
            .map((k) => {
              let status = "FREE";
              if (k.revoked) status = "REVOKED";
              else if (k.used) status = "USED";

              return `\`${k.key}\`\nStatus: **${status}**`;
            })
            .join("\n\n")
        : "No keys found."
    );
}

function buildPagination(page, totalPages) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`keys_prev_${page}`)
      .setLabel("⬅ Prev")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page === 0),

    new ButtonBuilder()
      .setCustomId(`keys_next_${page}`)
      .setLabel("Next ➡")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page >= totalPages - 1)
  );
}

/* ---------------- INTERACTIONS ---------------- */

client.on("interactionCreate", async (i) => {
  if (!i.isChatInputCommand() && !i.isButton()) return;

  try {
    /* ---------------- BUTTONS (PAGINATION) ---------------- */
    if (i.isButton()) {
      const [type, dir, pageStr] = i.customId.split("_");

      if (type === "keys") {
        const page = parseInt(pageStr);
        const res = await axios.get(`${API}/api/admin/keys`, {
          headers: { "x-admin-secret": process.env.ADMIN_SECRET },
        });

        const keys = res.data || [];
        const pageSize = 5;
        const totalPages = Math.ceil(keys.length / pageSize);

        let newPage = page;

        if (dir === "next") newPage++;
        if (dir === "prev") newPage--;

        const start = newPage * pageSize;
        const slice = keys.slice(start, start + pageSize);

        const embed = buildKeysEmbed(slice, newPage, totalPages);
        const row = buildPagination(newPage, totalPages);

        return i.update({ embeds: [embed], components: [row] });
      }
    }

    if (i.isChatInputCommand()) {
  try {
    if (!i.replied && !i.deferred) {
      await i.deferReply({ flags: 64 });
    }
  } catch (e) {
    console.log("DEFER FAILED", e);
    return;
  }
}

    if (i.commandName === "getkey") {
      const key = await getKey(i.user);
      return i.editReply(key ? `Key: \`${key}\`` : "No keys available.");
    }

    /* ---------------- KEYS (PAGED UI) ---------------- */
    if (i.commandName === "keys") {
      const res = await axios.get(`${API}/api/admin/keys`, {
        headers: { "x-admin-secret": process.env.ADMIN_SECRET },
      });

      const keys = res.data || [];
      const pageSize = 5;
      const page = 0;
      const totalPages = Math.ceil(keys.length / pageSize);

      const slice = keys.slice(0, pageSize);

      const embed = buildKeysEmbed(slice, page, totalPages);
      const row = buildPagination(page, totalPages);

      return i.editReply({ embeds: [embed], components: [row] });
    }

    /* ---------------- ACTIVITY ---------------- */
    if (i.commandName === "activity") {
      const res = await axios.get(`${API}/api/admin/activity`, {
        headers: { "x-admin-secret": process.env.ADMIN_SECRET },
      });

      const logs = (res.data || []).slice(0, 10);

      const embed = new EmbedBuilder()
        .setTitle("📜 Activity Log")
        .setColor(0x2b2d31)
        .setDescription(
          logs.length
            ? logs
                .map(
                  (l) =>
                    `**${l.event}**\nKey: \`${l.key ?? "none"}\`\nTime: ${l.createdAt}`
                )
                .join("\n\n")
            : "No activity."
        );

      return i.editReply({ embeds: [embed] });
    }

    /* ---------------- DASHBOARD ---------------- */
    if (i.commandName === "dashboard") {
      const res = await axios.get(`${API}/api/admin/stats`, {
        headers: { "x-admin-secret": process.env.ADMIN_SECRET },
      });

      const data = res.data || {};
      const percent = data.total
        ? Math.round((data.used / data.total) * 100)
        : 0;

      const embed = new EmbedBuilder()
        .setTitle("📊 AnkyAuth Dashboard")
        .setColor(percent > 80 ? 0xff0000 : percent > 50 ? 0xffa500 : 0x00ff00)
        .addFields(
          { name: "Total", value: String(data.total ?? 0), inline: true },
          { name: "Used", value: String(data.used ?? 0), inline: true },
          { name: "Unused", value: String(data.unused ?? 0), inline: true },
          { name: "Revoked", value: String(data.revoked ?? 0), inline: true },
          { name: "Usage", value: `${percent}%`, inline: true }
        )
        .setFooter({ text: "AnkyAuth System" })
        .setTimestamp();

      return i.editReply({ embeds: [embed] });
    }
  } catch (err) {
    console.error(err);

    if (!i.replied) {
      await i.reply({ content: "Error.", flags: 64 }).catch(() => {});
    }
  }
});

/* ---------------- READY ---------------- */

client.once("ready", () => {
  console.log("Bot online");
});

client.login(process.env.TOKEN);
