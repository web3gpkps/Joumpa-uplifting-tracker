# JOUMPA Uplifting Action Tracker

**Monitoring Hasil Evaluasi & Tindak Lanjut Perbaikan Layanan**

Aplikasi web untuk memantau tindak lanjut pelatihan Uplifting Service JOUMPA, Customer Service
Division PT Gapura Angkasa: 75 petugas di stasiun SUB, DPS, CGK, HLP dan KNO selama 10 minggu
(12 Okt s.d. 14 Des 2026). Isinya mengikuti workbook "Tracker Tindak Lanjut Uplifting JOUMPA",
sheet demi sheet.

## Siapa memakai apa

| Peran | Akses | Cakupan |
|---|---|---|
| Stasiun (kode di tabel `stations`) | tautan ruang kerja `/s/<token>`, tanpa akun | data stasiun sendiri |
| KPS | tautan ruang kerja dengan lingkup KPS, tanpa akun | semua stasiun |
| Akun cabang | daftar di `/register`, disetujui pemilik, lalu masuk di `/login`, area `/cabang` | cabang akun itu (KPS = semua stasiun) |
| Pemilik | masuk di `/login`, area `/admin` | semua stasiun, termasuk tautan, akun cabang, Parameter dan sinkronisasi |

Sheet yang tersedia: Dashboard, Master SDM, Log Performa, Cek BMI, Tindak Lanjut, Penggantian SDM
dan Laporan Mingguan (bisa dicetak A4). Di desktop pengisian memakai tabel ala spreadsheet
(navigasi keyboard, tempel dari Excel, simpan otomatis per baris); di ponsel memakai kartu.

Google Sheet replika tersinkron dua arah dengan database. Bila sel yang sama diubah di kedua sisi,
perubahan dari aplikasi yang dipakai dan nilai dari Sheet dicatat di log konflik.

## Teknologi

Next.js 16 (App Router, Cache Components), React 19, TypeScript, Tailwind CSS 4, Supabase
(Postgres, Auth, RLS), Vercel, Google Sheets API dan Apps Script. Paket dikelola dengan bun.

## Menjalankan secara lokal

```bash
bun install
cp .env.example .env.local   # lalu isi nilainya, lihat tabel di bawah
bun run dev
```

| Variabel | Untuk |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | koneksi aplikasi ke Supabase (publik) |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | mesin sinkronisasi, hanya di server |
| `GOOGLE_SERVICE_ACCOUNT_JSON`, `GOOGLE_SHEETS_ID` | akses service account ke Google Sheet |
| `SYNC_SECRET`, `SYNC_PING_SECRET` | otorisasi `POST /api/sync/run` (cron dan Apps Script) |
| `CONFLICT_POLICY` | opsional, bawaan `db-wins` |

Jangan pernah menaruh kunci service role atau kunci Google di variabel `NEXT_PUBLIC_*`.

## Database

Skema, RLS dan fungsi `share_*` ada di `supabase/migrations/`. Tes keamanan pgTAP di `tests/sql/`
membuktikan pemisahan antarstasiun, penolakan tautan yang dicabut, dan akses pemilik.

```bash
supabase db push --db-url "$SUPABASE_DB_URL"
supabase test db --db-url "$SUPABASE_DB_URL" tests/sql
```

Langkah produksi sekali jalan (pg_cron, Vault) ada di `supabase/production-setup.sql`.

### Daftar stasiun

Stasiun diambil dari tabel `public.stations` (kode, kelompok laporan, urutan), sama seperti tracker
Garuda: 35 stasiun, yaitu lima stasiun workbook (SUB, DPS, CGK, HLP, KNO) di urutan awal lalu stasiun
tracker Garuda berurutan abjad. Setiap stasiun membuat laporannya sendiri, kecuali CGK dan HLP yang
berbagi laporan "CGK & HLP". Menambah stasiun cukup satu baris:

```sql
insert into public.stations (code, report_group, sort) values ('XYZ', 'XYZ', 99);
```

Tautan, akun cabang, filter, form dan sinkronisasi langsung mengenalinya. Dashboard, Rekap dan Laporan
di Google Sheet sendiri masih menghitung lima stasiun workbook: rumusnya perlu diperluas di workbook bila
stasiun baru sudah punya petugas.

Tes keamanan juga bisa dijalankan tanpa Docker dan tanpa menyentuh database mana pun: setiap file
`tests/sql/*.test.sql` mendapat Postgres baru di PGlite dengan semua migrasi.

```bash
bun tests/sql/run.ts          # semua file
bun tests/sql/run.ts 08       # hanya file yang namanya memuat "08"
```

### Akun cabang

1. Orang mendaftar di `/register` (nama, email, kata sandi, cabang). Trigger di `auth.users` membuat profilnya
   `pending`; peran dan status dari form tidak pernah dipakai.
2. Pemilik menyetujui, menolak, mengganti cabang atau menghapus akun di **Akun Cabang** (`/admin/akun`).
3. Akun aktif masuk di `/login` dan dibawa ke `/cabang`, dengan lingkup cabangnya ditentukan di database.
4. Lupa kata sandi: `/forgot-password`, tautan email ke `/auth/callback`, lalu `/reset-password`.

Pengaturan di dashboard Supabase (tidak bisa lewat migrasi): Authentication, URL Configuration,
**Site URL** = alamat aplikasi dan **Redirect URLs** memuat `<alamat aplikasi>/auth/callback` (serta
`http://localhost:3000/auth/callback` untuk pengembangan). Pendaftaran email harus aktif, dengan konfirmasi
email. Pengirim email bawaan Supabase dibatasi jumlahnya; pasang SMTP sendiri bila pendaftar banyak.

## Tes

```bash
bun test                  # rumus workbook, agregasi, grid, sinkronisasi, komponen
bun tests/sql/run.ts      # tes keamanan SQL di PGlite
bun run lint
bun run build
```

## Dokumen

- `docs/SPEC.md`: model akses, model data, aturan dari workbook
- `docs/UX.md` dan `DESIGN.md`: perilaku layar dan arah visual
- `docs/SYNC.md` dan `apps-script/README.md`: sinkronisasi Google Sheet

Workbook sumber dan data seed berisi nama petugas, jadi tidak disimpan di repositori ini.
