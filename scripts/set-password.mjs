// Personel şifresi belirler: api/_lib/users.js içindeki hash'i günceller.
// Kullanım:  npm run set-password -- marko            (rastgele şifre üretir)
//            npm run set-password -- marko "yeni şifre"
import { readFileSync, writeFileSync } from "node:fs";
import { randomInt } from "node:crypto";
import { hashPassword } from "../api/_lib/password.js";

const [id, given] = process.argv.slice(2);
const file = new URL("../api/_lib/users.js", import.meta.url);
const src = readFileSync(file, "utf8");
const re = new RegExp(`(id: "${id}",[^\\n]*hash: ")[^"]*(")`);
if (!id || !re.test(src)) {
  console.error(`Unknown user "${id || ""}". Usage: npm run set-password -- <user id> [password]`);
  process.exit(1);
}
const ABC = "abcdefghjkmnpqrstuvwxyz23456789";
const pick = () => Array.from({ length: 4 }, () => ABC[randomInt(ABC.length)]).join("");
const password = given || `${pick()}-${pick()}-${pick()}`;
writeFileSync(file, src.replace(re, `$1${hashPassword(password)}$2`));
console.log(`${id}: ${password}`);
