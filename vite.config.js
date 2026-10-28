import { existsSync } from "node:fs";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// `npm run dev` sırasında /api/* isteklerini api/ klasöründeki Vercel fonksiyonlarına yönlendirir
function devApi() {
  return {
    name: "dev-api",
    configureServer(server) {
      // .env.local içindeki şifre ve AUTH_SECRET değişkenleri sunucu fonksiyonlarına geçsin (Vercel'de bunu Vercel yapar)
      Object.assign(process.env, loadEnv(server.config.mode, process.cwd(), ""), { ...process.env });
      server.middlewares.use(async (req, res, next) => {
        const m = req.url.match(/^\/api\/([a-z]+)(?:[?#]|$)/);
        if (!m) return next();
        if (!existsSync(`api/${m[1]}.js`)) { res.statusCode = 404; return res.end(); }
        try {
          const mod = await server.ssrLoadModule(`/api/${m[1]}.js`);
          await mod.default(req, res);
        } catch (e) {
          next(e);
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), devApi()],
});
