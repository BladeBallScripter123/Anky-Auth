import { Router } from "express";
import { db } from "@workspace/db";
import {
  availableKeysTable,
  licenceKeysTable,
  hwidLogTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

/* ---------------- LOG HWID (AUDIT ONLY) ---------------- */

async function logHwid(key, hwid) {
  if (!hwid) return;

  await db.insert(hwidLogTable).values({
    key,
    hwid,
    firstSeenAt: new Date(),
    lastSeenAt: new Date(),
  });
}

/* ---------------- GET UNUSED KEY ---------------- */

router.get("/api/keys/unused", async (_req, res) => {
  const [key] = await db
    .select()
    .from(availableKeysTable)
    .where(eq(availableKeysTable.revoked, false))
    .limit(1);

  if (!key) return res.status(404).json({ error: "no keys" });

  return res.json({ key: key.key });
});

/* ---------------- ACTIVATE (FIXED HWID LOCK) ---------------- */

router.post("/api/keys/activate", async (req, res) => {
  const { key, hwid } = req.body;

  if (!key || !hwid)
    return res.json({ ok: false, reason: "missing data" });

  const normal = key.trim().toUpperCase();
  const device = hwid.trim();

  const [exists] = await db
    .select()
    .from(availableKeysTable)
    .where(eq(availableKeysTable.key, normal))
    .limit(1);

  if (!exists) return res.json({ ok: false, reason: "invalid" });
  if (exists.revoked) return res.json({ ok: false, reason: "revoked" });

  // 🔥 REAL BIND CHECK (source of truth)
  const [binding] = await db
    .select()
    .from(licenceKeysTable)
    .where(eq(licenceKeysTable.key, normal))
    .limit(1);

  // FIRST TIME → bind HWID permanently
  if (!binding) {
    await db.insert(licenceKeysTable).values({
      key: normal,
      hwid: device,
    });

    await logHwid(normal, device);

    return res.json({ ok: true, status: "bound" });
  }

  // SAME DEVICE → allow
  if (binding.hwid === device) {
    await logHwid(normal, device);
    return res.json({ ok: true, status: "ok" });
  }

  // DIFFERENT DEVICE → reject
  await logHwid(normal, device);

  return res.json({
    ok: false,
    reason: "hwid_locked",
  });
});

/* ---------------- ADMIN KEYS ---------------- */

router.get("/api/admin/keys", async (_req, res) => {
  const keys = await db.select().from(availableKeysTable);

  const enriched = await Promise.all(
    keys.map(async (k) => {
      const [binding] = await db
        .select()
        .from(licenceKeysTable)
        .where(eq(licenceKeysTable.key, k.key))
        .limit(1);

      const logs = await db
        .select()
        .from(hwidLogTable)
        .where(eq(hwidLogTable.key, k.key));

      return {
        key: k.key,
        revoked: k.revoked,
        used: !!binding,
        hwid: binding?.hwid || null,
        attempts: logs.length,
      };
    })
  );

  return res.json(enriched);
});

/* ---------------- SINGLE KEY ---------------- */

router.get("/api/admin/key/:key", async (req, res) => {
  const key = req.params.key.toUpperCase();

  const [base] = await db
    .select()
    .from(availableKeysTable)
    .where(eq(availableKeysTable.key, key))
    .limit(1);

  if (!base) return res.status(404).json({ error: "not found" });

  const [binding] = await db
    .select()
    .from(licenceKeysTable)
    .where(eq(licenceKeysTable.key, key))
    .limit(1);

  const logs = await db
    .select()
    .from(hwidLogTable)
    .where(eq(hwidLogTable.key, key));

  return res.json({
    key: base.key,
    revoked: base.revoked,
    used: !!binding,
    hwid: binding?.hwid || null,
    attempts: logs.map((h) => h.hwid),
  });
});

/* ---------------- REVOKE ---------------- */

router.post("/api/admin/revoke", async (req, res) => {
  const { key } = req.body;

  await db
    .update(availableKeysTable)
    .set({ revoked: true })
    .where(eq(availableKeysTable.key, key.toUpperCase()));

  return res.json({ ok: true });
});

/* ---------------- DELETE ---------------- */

router.delete("/api/admin/key/:key", async (req, res) => {
  const key = req.params.key.toUpperCase();

  await db.delete(availableKeysTable).where(eq(availableKeysTable.key, key));
  await db.delete(licenceKeysTable).where(eq(licenceKeysTable.key, key));
  await db.delete(hwidLogTable).where(eq(hwidLogTable.key, key));

  return res.json({ ok: true });
});

export default router;
