# Misi Pencoblosan untuk Android

**Main di browser:** https://walinggaanggi-arch.github.io/kpukalbar-misi-pencoblosan/

**Unduh APK terbaru:** https://github.com/walinggaanggi-arch/kpukalbar-misi-pencoblosan/releases/latest/download/misi-pencoblosan.apk

Proyek Android yang membungkus game **Misi Pencoblosan** (HTML5) menjadi aplikasi layar penuh dan terkunci landscape. Isi game ada di `app/src/main/assets/index.html`.

- Android 7.0 ke atas (minSdk 24), target Android 16 (API 36) sesuai syarat Google Play.
- Progres tersimpan otomatis di HP.
- Kartu hasil bisa disimpan ke Galeri (`Pictures/MisiPencoblosan`) dan dibagikan langsung ke WhatsApp, Instagram, dan aplikasi lain.
- Game tetap bisa dimainkan tanpa internet. Kalau ada internet, huruf pixel (Pixelify Sans) dimuat dari Google Fonts.

---

## Cara 1: Android Studio (disarankan)

1. Pasang **Android Studio** versi terbaru dari developer.android.com/studio.
2. Ekstrak zip ini, lalu pilih **File > Open** dan arahkan ke folder `MisiPencoblosan`.
3. Tunggu proses *Gradle Sync* selesai. Saat pertama kali, prosesnya mengunduh perangkat build sehingga butuh internet dan beberapa menit. Kalau Android Studio menawarkan pembaruan Android Gradle Plugin, boleh disetujui.

### APK untuk uji coba (debug)
- Pilih **Build > Build App Bundle(s) / APK(s) > Build APK(s)**.
- Setelah selesai, klik **locate**. File-nya ada di `app/build/outputs/apk/debug/app-debug.apk`.
- Kirim file itu ke HP, lalu pasang. HP perlu mengizinkan "Instal aplikasi tidak dikenal".

### APK untuk dibagikan resmi (release, ditandatangani)
1. Pilih **Build > Generate Signed App Bundle or APK**, lalu pilih **APK**.
2. Pilih **Create new...** untuk membuat *keystore* (kunci tanda tangan). Isi nama instansi dan kata sandi.
   - **Simpan file keystore dan kata sandinya baik-baik.** Tanpa keystore yang sama, aplikasi tidak bisa diperbarui. Jangan unggah keystore ke GitHub.
3. Pilih build **release**, lalu klik **Create**. Hasilnya ada di `app/release/app-release.apk`.

### Untuk Google Play Store
- Play Store menerima **App Bundle (.aab)**, bukan .apk. Ikuti langkah yang sama, tapi pilih **Android App Bundle**.
- Siapkan akun Google Play Console (sebaiknya akun organisasi atas nama instansi), kebijakan privasi, rating konten, dan formulir Keamanan Data. Game ini tidak mengumpulkan data pribadi; nama pemain hanya tersimpan di HP.
- Ikon Play Store 512×512 sudah tersedia: `play-store-icon-512.png`.

---

## Cara 2: Dibangunkan otomatis oleh GitHub (tanpa memasang apa pun)

Repositori ini sudah diatur: setiap ada perubahan di cabang `main` (misalnya `app/src/main/assets/index.html` diganti), GitHub otomatis membangun APK baru dan menerbitkannya di halaman **Releases**. Tautan unduhan di atas selalu mengarah ke versi terbaru.

Untuk membangun ulang tanpa mengubah file: buka tab **Actions**, pilih **Build APK**, lalu klik **Run workflow**.

APK dari cara ini adalah versi debug, cocok untuk uji coba dan dibagikan terbatas. Untuk rilis resmi atau Play Store, gunakan Cara 1.

---

## Sebelum rilis resmi, ubah hal berikut

| Apa | Di mana | Keterangan |
|---|---|---|
| Nama paket | `app/build.gradle.kts`: `namespace` dan `applicationId` | Saat ini `id.misipencoblosan.game`. Ganti dengan nama paket milik instansi, misalnya berbasis domain resmi. Jangan diubah lagi setelah terbit di Play Store. Kalau `namespace` diubah, pindahkan juga folder `java/id/misipencoblosan/game` dan baris `package` di `MainActivity.java`. |
| Nomor versi | `versionCode` dan `versionName` | Naikkan `versionCode` (1, 2, 3, …) setiap kali merilis pembaruan. |
| Nama aplikasi | `app/src/main/res/values/strings.xml` | Saat ini "Misi Pencoblosan". |
| Isi game | `app/src/main/assets/index.html` | Ganti file ini setiap kali game diperbarui. |

## Catatan
- Di tablet dengan Android 16, sistem bisa mengabaikan kunci landscape. Game tetap bisa dimainkan dalam posisi tegak di tablet.
- Tombol Kembali perlu ditekan dua kali untuk keluar dari game.
