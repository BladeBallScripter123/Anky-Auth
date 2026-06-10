import { Client, GatewayIntentBits } from "discord.js";
import axios from "axios";
import crypto from "crypto";

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

const API = "https://yo-bot--ankymacro1.replit.app";

/* ---------------- SIGN REQUEST ---------------- */

function sign(secret: string) {
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
  const { signature, timestamp } = sign(process.env.BOT_SECRET!);

  const res = await axios.get(`${API}/api/keys/unused`, {
    headers: {
      "x-signature": signature,
      "x-timestamp": timestamp,
    },
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
  } catch (err) {
    console.error(err);
    return i.editReply("API error.");
  }
});

client.once("ready", () => {
  console.log(`Bot online: ${client.user?.tag}`);
});

client.login(process.env.TOKEN!);
