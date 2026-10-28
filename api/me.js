import { handle, send } from "./_lib/http.js";
import { requireUser } from "./_lib/auth.js";

export default handle(async (req, res) => {
  send(res, 200, { user: requireUser(req) });
});
