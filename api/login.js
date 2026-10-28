import { handle, readJson, send, fail } from "./_lib/http.js";
import { findUser, passwordOf, publicUser } from "./_lib/users.js";
import { checkPassword } from "./_lib/password.js";
import { startSession } from "./_lib/auth.js";

export default handle(async (req, res) => {
  if (req.method !== "POST") throw fail(405, "Method not allowed");
  const { username, password } = await readJson(req);
  const user = findUser(username);
  if (!checkPassword(String(password || ""), passwordOf(user))) {
    await new Promise((r) => setTimeout(r, 400)); // deneme-yanılmayı yavaşlatır
    throw fail(401, "Wrong name or password");
  }
  startSession(req, res, user);
  send(res, 200, { user: publicUser(user) });
});
