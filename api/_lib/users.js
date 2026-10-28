import { env } from "./secrets.js";

// Klinik personeli. Şifreler api/_lib/secrets.js içinde (ya da aynı adlı ortam değişkenlerinde):
//   <ID büyük harf>_PASSWORD   örn. MARKO_PASSWORD, THOMAS_PASSWORD
// Yeni kişi eklemek için bir satır ekleyin, src/config.js içindeki STAFF listesine de ekleyin ve şifre değişkenini tanımlayın.
export const USERS = [
  { id: "thomas", name: "Thomas", role: "staff" },
  { id: "marian", name: "Marian", role: "staff" },
  { id: "anxhela", name: "Anxhela", role: "staff" },
  { id: "yagiz", name: "Yağız", role: "staff" },
  { id: "adrian", name: "Adrian", role: "staff" },
  { id: "medo", name: "Medo", role: "staff" },
  { id: "marko", name: "Marko", role: "admin" },
];

export const findUser = (id) => USERS.find((u) => u.id === String(id || "").toLowerCase().trim());
export const passwordOf = (u) => (u ? env(`${u.id.toUpperCase()}_PASSWORD`) : undefined);
export const publicUser = (u) => u && { id: u.id, name: u.name, role: u.role };
