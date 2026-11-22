# Portofolio 3D Full-Stack Faza Fauzan Adzima

Website portofolio resmi Faza Fauzan Adzima dengan tema merah-hitam, latar belakang naga 3D WebGL (Three.js prosedural), backend JavaScript dan Python di Vercel Functions, serta persistensi PostgreSQL di Supabase.

## Fitur Utama

1. **Latar Belakang Naga 3D Real-Time (`public/js/dragon3d.js`)**: Pahatan naga 3D obsidian dan aksen merah crimson yang merespons kursor dan scroll, dilengkapi tombol jeda animasi, dukungan `prefers-reduced-motion`, dan fallback SVG (`dragon-fallback.svg`).
2. **Backend JavaScript (`/api/health`, `/api/portfolio`, `/api/contact`)**: Mengambil daftar proyek dan prestasi terpublikasi dari Supabase, serta memvalidasi dan menyimpan pesan kontak melalui fungsi RPC terproteksi RLS.
3. **Backend Python (`/api/security_check`, `/api/export_cv`)**: Menginspeksi 6 header keamanan HTTP domain publik HTTPS dengan proteksi anti-SSRF pada resolusi DNS dan pengalihan HTTP, mencatat ringkasan skor ke Supabase, serta mengekspor portofolio ke Markdown dan JSON.

## Pengembangan Lokal

Salin `.env.example` ke `.env.local` lalu isi `SUPABASE_URL` dan `SUPABASE_PUBLISHABLE_KEY`, kemudian jalankan:

```bash
node scripts/dev-server.mjs
```

Buka `http://127.0.0.1:4173` di browser.

## Pengujian Otomatis

```bash
node --test tests/js/api.test.js
python -m unittest discover -s tests/py -v
```
