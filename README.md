# Tedavi Planlayıcı (React + Vite + Three.js)

Diş kliniği için 3D implant / kron tedavi planı. Hasta adı girilir, diş şemasında dişler işaretlenir,
3D çene modeli üzerinde tedavi animasyonu oynatılır ve hastaya özel link / QR kodu oluşturulur.

## Çalıştırma
```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # üretim derlemesi -> dist/
```

## Klinik bilgileri
`src/config.js` içindeki adı ve telefonu değiştir.

## Vercel'e yükleme
1. Bu klasörü bir GitHub reposuna yükle.
2. vercel.com → **Add New → Project** → repoyu seç. Framework otomatik **Vite** gelir → **Deploy**.
   (Terminalden: `npm i -g vercel && vercel --prod`)

## Hasta linkleri
- Plan ekranındaki **Hastayla paylaş** kutusu `#p=...` ile biten bir link ve QR kodu üretir. `#` sonrası sunucuya gitmediği için hasta bilgisi sunucu loglarına düşmez (eski `?p=` linkleri de açılır).
- Plan linkin içine yazılır; sunucu ya da veritabanı yoktur. Linki bilen herkes planı görebilir.
- "Baş harfler" seçeneği (varsayılan açık) linkte ad yerine "A. Y." yazar.

## Dosya yapısı
```
src/
  App.jsx                  ekran akışı, hasta linki ile açılış
  config.js                klinik adı / telefon
  components/
    Intake.jsx             1. ekran: hasta bilgileri
    ChartScreen.jsx        2. ekran: araçlar + seçilen tedaviler
    ToothChart.jsx         SVG diş şeması (FDI)
    PlanView.jsx           3. ekran: oynatıcı, aşamalar, özet
    SharePanel.jsx         hasta linki + QR kod
  three/JawScene.js        3D çene modeli, implant, kron, matkap animasyonları (Three.js r128)
  data/teeth.js            diş geometrisi, adlar, örnek hasta
  data/timeline.js         tedavi aşamaları ve zaman çizelgesi
  lib/share.js             link kodlama / çözme
  lib/anim.js              yardımcı animasyon fonksiyonları
```

Three.js sürümü 0.128.0'a sabitlendi; ışık ve renk ayarları bu sürüme göre yapıldı.
