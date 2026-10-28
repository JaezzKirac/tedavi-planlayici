import { handle, send, fail } from "./_lib/http.js";
import { endSession } from "./_lib/auth.js";

export default handle(async (req, res) => {
  if (req.method !== "POST") throw fail(405, "Method not allowed");
  endSession(req, res);
  send(res, 200, { ok: true });
});
