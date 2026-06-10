import { Client, GatewayIntentBits } from "discord.js";
import axios from "axios";
import crypto from "crypto";

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

const API = "https://yo-bot--ankymacro1.replit.app";

/* ---------------- SIGN REQUEST ---------------- */

function sign(secret?: string) {
  if (!secret) throw new Error("BOT_SECRET missing");

  const timestamp = Date.now().toString();
  const payload = `${timestamp}.`;

  const signature = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");

  return { signature, timestamp };
}

/* ---------------- GET KEY ---------------- */

async function getKey() {
  const secret = process.env.BOT_SECRET;
  const { signature, timestamp } = sign(secret);

  const res = await axios.get(`${API}/api/keys/unused`, {
    headers: {
      "x-signature": signature,
      "x-timestamp": timestamp,
    },
    timeout: 8000,
  });

  return res.data?.key;
}

/* ---------------- COMMAND ---------------- */

client.on("interactionCreate", async (i) => {
  if (!i.isChatInputCommand()) return;
  if (i.commandName !== "getkey") return;

  await i.deferReply({ ephemeral: true });

  try {
    const key = await getKey();

    if (!key) {
      return i.editReply("No keys available.");
    }

    return i.editReply(`Your key: ${key}`);
  } catch (err: any) {
    console.error("GETKEY ERROR:", err?.response?.data || err.message);
    return i.editReply("API error (check backend or signature).");
  }
});

client.once("ready", () => {
  console.log(`Bot online: ${client.user?.tag}`);
});

client.login(process.env.TOKEN!);
