# Momentum

Momentum adalah daily focus planner lokal yang membantu Anda menjawab tiga pertanyaan sederhana:

1. Apa yang perlu saya kerjakan hari ini?
2. Apa yang sedang saya fokuskan sekarang?
3. Apa yang sudah saya selesaikan?

Momentum tidak memerlukan akun atau server. Task, sesi fokus, review, dan pengaturan disimpan di browser pada perangkat yang sedang digunakan.

## Fitur utama

- Inbox untuk mencatat, mencari, memfilter, mengedit, dan menghapus task.
- Rencana harian berisi maksimal lima task yang belum selesai.
- Pengurutan prioritas dengan kontrol keyboard-friendly.
- Focus timer 15, 25, 45, atau 60 menit dengan pause, resume, dan cancel.
- Pemulihan timer yang tetap akurat setelah halaman di-refresh.
- Notifikasi browser opsional ketika sesi selesai.
- Ringkasan task dan sesi yang diselesaikan hari ini.
- Refleksi harian hingga 500 karakter dan riwayat review sebelumnya.
- Penanganan task terlambat: pindahkan ke besok atau kembalikan ke Inbox.
- Tema light, dark, atau mengikuti pengaturan sistem.
- Export, import, dan penghapusan seluruh data dengan konfirmasi.

## Menjalankan Momentum

### Kebutuhan

- Node.js `^20.19.0` atau `>=22.12.0`.
- npm.
- Browser modern dengan dukungan IndexedDB.

### Instalasi

```sh
npm install
npm run dev
```

Buka alamat yang ditampilkan Vite di terminal, biasanya `http://localhost:5173`.

Untuk menjalankan build produksi secara lokal:

```sh
npm run build
npm run preview
```

### Menjalankan dengan Docker

Build image produksi dan jalankan container:

```sh
docker build -t momentum .
docker run --rm -p 8080:80 --name momentum momentum
```

Buka `http://localhost:8080`. Data tetap disimpan di IndexedDB browser, bukan di dalam container, sehingga restart container tidak menghapus workspace pada browser yang sama.

Untuk menghentikan container, tekan `Ctrl+C` pada terminal yang menjalankannya.

## Cara menggunakan

### 1. Catat task di Inbox

Buka **Inbox**, lalu isi judul task. Notes, tag, dan estimasi sesi fokus bersifat opsional. Task dapat diedit, dicari berdasarkan judul, atau difilter berdasarkan tag.

Task yang dihapus dapat dipulihkan dengan tombol **Undo** selama notifikasi undo masih tersedia.

### 2. Susun rencana hari ini

Pilih **Plan today** pada task di Inbox. Momentum membatasi rencana menjadi maksimal lima task yang belum selesai agar hari tetap realistis.

Di halaman **Today**, gunakan tombol panah untuk mengubah urutan prioritas. Task juga dapat dikembalikan ke Inbox.

### 3. Jalankan sesi fokus

Pilih **Focus** pada salah satu task Today, tentukan durasi sesi, lalu tekan **Start focus session**.

- **Pause** membekukan waktu tersisa.
- **Resume** melanjutkan dari waktu tersebut.
- **Cancel session** meminta konfirmasi jika sesi sudah berjalan.
- Refresh atau membuka ulang halaman tidak mereset timer aktif.

Momentum hanya mengizinkan satu sesi fokus aktif. Jika izin notifikasi browser diberikan, pemberitahuan muncul ketika sesi selesai.

### 4. Selesaikan task

Setelah pekerjaan selesai, tekan **Complete** pada task di halaman Today. Task yang selesai dapat dibuka kembali dengan **Reopen**.

Jika rencana Today sudah penuh ketika task dibuka kembali, task tersebut dikembalikan ke Inbox agar batas lima task tidak terlewati.

### 5. Tutup hari dengan Review

Halaman **Review** menampilkan task dan jumlah sesi fokus yang selesai pada tanggal hari ini. Anda dapat menyimpan satu refleksi hingga 500 karakter.

Task dari hari sebelumnya tetap terlihat sebagai overdue sampai Anda memilih untuk:

- memindahkannya ke besok; atau
- mengembalikannya ke Inbox.

Refleksi yang lebih lama tersedia sebagai riwayat read-only.

## Pengaturan dan backup

Buka **Settings** melalui tombol sekunder di sidebar atau header mobile.

### Tema dan durasi

Pilih tema **System**, **Light**, atau **Dark**, serta durasi fokus default 15, 25, 45, atau 60 menit. Pengaturan bertahan setelah refresh.

### Export data

Tekan **Export JSON backup** untuk mengunduh task, sesi yang sudah berakhir, review, dan pengaturan dalam format Momentum Backup v1.

Timer yang sedang aktif tidak dimasukkan ke backup karena merupakan state sementara.

### Import data

Pilih file backup `.json`. Momentum memvalidasi seluruh file dan menampilkan ringkasan sebelum meminta konfirmasi.

Import akan mengganti semua data yang ada. Jika import dikonfirmasi, timer aktif dibatalkan dan dibersihkan bersama penggantian data dalam satu transaksi.

### Menghapus seluruh data

Gunakan **Erase all data** untuk menghapus task, sesi, review, pengaturan, dan timer aktif. Tindakan ini memerlukan konfirmasi dan tidak dapat di-undo.

## Privasi dan keamanan data

- Semua data aplikasi disimpan secara lokal menggunakan IndexedDB.
- Momentum tidak memiliki akun, backend, analytics, atau sinkronisasi antarperangkat.
- Data pada satu browser tidak otomatis tersedia di browser atau perangkat lain.
- Menghapus site data, browser profile, atau storage browser dapat menghapus workspace Momentum.
- Buat backup JSON secara berkala jika data perlu dipertahankan atau dipindahkan.

## Aksesibilitas dan perangkat

Momentum dapat digunakan dengan keyboard, menyediakan focus indicator yang terlihat, mendukung skip navigation, dan menghormati `prefers-reduced-motion`. Tampilan telah diverifikasi mulai dari viewport mobile 360 px hingga desktop.

## Pemeriksaan proyek

```sh
npm run typecheck
npm run lint
npm run test
npm run test:e2e
npm run build
```

Release gate terakhir lulus dengan 95 unit/component tests dan 28 Playwright checks pada mobile dan desktop Chromium.

## Batasan versi 1

Momentum v1 belum menyediakan akun, sinkronisasi antarperangkat, kolaborasi, recurring task, integrasi kalender, atau aplikasi native.

Dokumentasi produk dan status implementasi tersedia di [requirements](docs/REQUIREMENTS.md), [implementation plan](PLAN.md), dan [progress report](docs/reportprogress.md).
