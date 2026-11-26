package id.misipencoblosan.game;

import android.Manifest;
import android.app.Activity;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.ContentValues;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.media.MediaScannerConnection;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

/** Membungkus game HTML5 (assets/index.html) dalam WebView layar penuh. */
public class MainActivity extends Activity {

    private WebView web;
    private long lastBack = 0;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        web = new WebView(this);
        web.setBackgroundColor(0xFF2E0606);
        setContentView(web);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);          // simpan progres (localStorage)
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(true);

        web.addJavascriptInterface(new Bridge(), "AndroidBridge");
        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
                Uri u = req.getUrl();
                if ("file".equals(u.getScheme())) return false;
                // Tautan luar dibuka di browser, bukan di dalam game.
                try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (Exception ignored) { }
                return true;
            }
        });

        if (state != null) web.restoreState(state);
        else web.loadUrl("file:///android_asset/index.html");
        hideSystemBars();
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        web.saveState(out);
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideSystemBars();
    }

    @Override
    protected void onPause() {
        super.onPause();
        web.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        web.onResume();
        hideSystemBars();
    }

    @Override
    protected void onDestroy() {
        if (web != null) web.destroy();
        super.onDestroy();
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        long now = System.currentTimeMillis();
        if (now - lastBack < 2000) {
            super.onBackPressed();
        } else {
            lastBack = now;
            toast("Tekan Kembali sekali lagi untuk keluar. Progres tersimpan otomatis.");
        }
    }

    @SuppressWarnings("deprecation")
    private void hideSystemBars() {
        if (Build.VERSION.SDK_INT >= 30) {
            getWindow().setDecorFitsSystemWindows(false);
            WindowInsetsController c = getWindow().getInsetsController();
            if (c != null) {
                c.hide(WindowInsets.Type.systemBars());
                c.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
            }
        } else {
            getWindow().getDecorView().setSystemUiVisibility(
                    View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                            | View.SYSTEM_UI_FLAG_FULLSCREEN
                            | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                            | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                            | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                            | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN);
        }
    }

    private void toast(String msg) {
        Toast.makeText(this, msg, Toast.LENGTH_LONG).show();
    }

    /** Menyimpan PNG ke Galeri (Pictures/MisiPencoblosan). Mengembalikan Uri, atau null. */
    private Uri savePng(String base64, String name) {
        try {
            byte[] data = Base64.decode(base64, Base64.DEFAULT);
            if (Build.VERSION.SDK_INT >= 29) {
                ContentValues v = new ContentValues();
                v.put(MediaStore.Images.Media.DISPLAY_NAME, name);
                v.put(MediaStore.Images.Media.MIME_TYPE, "image/png");
                v.put(MediaStore.Images.Media.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/MisiPencoblosan");
                v.put(MediaStore.Images.Media.IS_PENDING, 1);
                Uri uri = getContentResolver().insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, v);
                if (uri == null) return null;
                try (OutputStream o = getContentResolver().openOutputStream(uri)) {
                    if (o == null) return null;
                    o.write(data);
                }
                v.clear();
                v.put(MediaStore.Images.Media.IS_PENDING, 0);
                getContentResolver().update(uri, v, null, null);
                return uri;
            } else {
                if (checkSelfPermission(Manifest.permission.WRITE_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED) {
                    requestPermissions(new String[]{Manifest.permission.WRITE_EXTERNAL_STORAGE}, 1);
                    toast("Izinkan akses penyimpanan, lalu tekan Simpan sekali lagi.");
                    return null;
                }
                File dir = new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_PICTURES), "MisiPencoblosan");
                if (!dir.exists() && !dir.mkdirs()) return null;
                File f = new File(dir, name);
                try (FileOutputStream o = new FileOutputStream(f)) {
                    o.write(data);
                }
                MediaScannerConnection.scanFile(this, new String[]{f.getAbsolutePath()}, new String[]{"image/png"}, null);
                return Uri.fromFile(f);
            }
        } catch (Exception e) {
            return null;
        }
    }

    /** Fungsi yang bisa dipanggil game lewat window.AndroidBridge. */
    private class Bridge {
        @JavascriptInterface
        public void saveImage(final String base64, final String name) {
            runOnUiThread(() -> {
                Uri u = savePng(base64, name);
                if (u != null) toast("Kartu hasil tersimpan di Galeri (Pictures/MisiPencoblosan).");
                else if (Build.VERSION.SDK_INT >= 29) toast("Gagal menyimpan gambar.");
            });
        }

        @JavascriptInterface
        public void shareImage(final String base64, final String name, final String caption) {
            runOnUiThread(() -> {
                Uri u = savePng(base64, name);
                if (u == null) {
                    if (Build.VERSION.SDK_INT >= 29) toast("Gagal menyiapkan gambar untuk dibagikan.");
                    return;
                }
                if (Build.VERSION.SDK_INT < 29) {
                    toast("Kartu tersimpan di Galeri. Bagikan dari aplikasi Galeri, ya.");
                    return;
                }
                Intent i = new Intent(Intent.ACTION_SEND);
                i.setType("image/png");
                i.putExtra(Intent.EXTRA_STREAM, u);
                i.putExtra(Intent.EXTRA_TEXT, caption);
                i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                startActivity(Intent.createChooser(i, "Bagikan hasil Misi Pencoblosan"));
            });
        }

        @JavascriptInterface
        public void copyText(final String text) {
            runOnUiThread(() -> {
                ClipboardManager cm = (ClipboardManager) getSystemService(CLIPBOARD_SERVICE);
                if (cm != null) {
                    cm.setPrimaryClip(ClipData.newPlainText("caption", text));
                    if (Build.VERSION.SDK_INT < 33) toast("Caption tersalin.");
                }
            });
        }
    }
}
