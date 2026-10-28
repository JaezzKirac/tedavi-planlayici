// GEÇİCİ: sırlar kodda. Aynı adla bir ortam değişkeni (Environment Variable) tanımlanırsa o kullanılır.
// DİKKAT: GitHub reposu herkese açıksa (public) bu şifreleri herkes görür. Repoyu "Private" yapın.
// Şifre değiştirmek için buradaki değeri değiştirip yeniden deploy edin.
const SECRETS = {
  AUTH_SECRET: "oELjU40AtRXRP-XdgyQJkYB_sjFb-vVDrRMQdPTSx0s",
  THOMAS_PASSWORD: "gt29-fesw-nrbv",
  MARIAN_PASSWORD: "rcp3-fmk9-hwgb",
  ANXHELA_PASSWORD: "fmyy-g8mj-yp6z",
  YAGIZ_PASSWORD: "c6yp-uqm8-6yfc",
  ADRIAN_PASSWORD: "4sfv-dwmz-uea5",
  MEDO_PASSWORD: "z2r4-5uz6-2rsy",
  MARKO_PASSWORD: "sqvk-amug-v4uc",
  // Ortak hasta listesi için ücretsiz Upstash Redis veritabanı (upstash.com → Create Database → REST API).
  // Boş kalırsa: yerelde .data/db.json kullanılır, Vercel'de panel "Storage is not configured" hatası verir.
  UPSTASH_REDIS_REST_URL: "",
  UPSTASH_REDIS_REST_TOKEN: "",
};

export const env = (key) => process.env[key] || SECRETS[key] || undefined;
