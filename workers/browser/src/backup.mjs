import { DatabaseSync } from "node:sqlite";
import { existsSync, mkdirSync, chmodSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { parseArgs } from "node:util";
const { values } = parseArgs({
  options: { to: { type: "string" }, verify: { type: "string" } },
});
process.umask(0o077);
if (values.verify) {
  const db = new DatabaseSync(resolve(values.verify), { readOnly: true });
  try {
    if (db.prepare("PRAGMA quick_check").get().quick_check !== "ok")
      throw new Error("backup_corrupt");
    console.log(
      JSON.stringify({
        status: "verified",
        jobs: db.prepare("SELECT count(*) n FROM jobs").get().n,
        captures: db.prepare("SELECT count(*) n FROM captures").get().n,
      }),
    );
  } finally {
    db.close();
  }
} else {
  if (!values.to) throw new Error("Provide --to /private/path/backup.sqlite");
  const target = resolve(values.to),
    source = resolve(process.env.WORKER_DB ?? "data/worker.sqlite");
  if (existsSync(target))
    throw new Error("Backup destination already exists; choose a new name");
  if (!existsSync(source)) throw new Error("Worker database does not exist");
  mkdirSync(dirname(target), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(source);
  try {
    db.prepare("VACUUM INTO ?").run(target);
    chmodSync(target, 0o600);
    console.log(JSON.stringify({ status: "backup_created" }));
  } finally {
    db.close();
  }
}
