// Klinik personeli. Şifreler yalnızca hash olarak saklanır; değiştirmek için:
//   npm run set-password -- <id> ["yeni şifre"]
// Yeni kişi eklemek için bir satır ekleyip set-password çalıştırın, src/config.js içindeki STAFF listesine de ekleyin.
export const USERS = [
  { id: "thomas", name: "Thomas", role: "staff", hash: "scrypt$XWIWAtXxcfx1NwTULRQmYg$CBSZ1DMtwqJyX5jyOu2zS4vPzMnoxr7YxoA3-Xmeurw" },
  { id: "marian", name: "Marian", role: "staff", hash: "scrypt$FSqz9XT3zIIl9sFTpuH8Mw$sr0Bq9wOWJm7eTnIpAZENqTmPNJC2jtqg5RfKTbVoFk" },
  { id: "anxhela", name: "Anxhela", role: "staff", hash: "scrypt$NhVy5g6E0ImdKsLpTQRpwg$h5x9AlGnCF88AP7rx2HYOVpAwlHWN7pvmZ1qYz-MRoI" },
  { id: "yagiz", name: "Yağız", role: "staff", hash: "scrypt$xIDdrz3as3d3uUXUmwK9xQ$P7N4quTBV1IprlhwAtdANpNJU_is0WWvGBBwDomt4pg" },
  { id: "adrian", name: "Adrian", role: "staff", hash: "scrypt$enELhCvBVfNGSZzdz-mLhw$yMJ8bi4pWdPfOFR3uEY9m8YSL-bhqWSuLo7tB2nL62w" },
  { id: "medo", name: "Medo", role: "staff", hash: "scrypt$fuLUcpBakUMh2e1lGE8pKw$K_87p5eubwcH4TosPw8isJxiTD8wPyYVDP_ZEFakyVg" },
  { id: "marko", name: "Marko", role: "admin", hash: "scrypt$V6FC1fNBeTAgwWV_TJYatA$rFvfkZI0uons3ox_TdE4cwGZi21pSdSksrf_IAiaIvk" },
];

export const findUser = (id) => USERS.find((u) => u.id === String(id || "").toLowerCase().trim());
export const publicUser = (u) => u && { id: u.id, name: u.name, role: u.role };
