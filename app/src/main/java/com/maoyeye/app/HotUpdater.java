package com.maoyeye.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Log;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

/**
 * 热更新：从 GitHub 拉取 update/version.json，发现更高版本时下载 web.zip，
 * 解压到 filesDir/web 并切换到该目录加载，无需重新安装 APK。
 */
public final class HotUpdater {

    private static final String TAG = "MaoYeyeUpdater";

    private static final String[] BASES = {
            "https://cdn.jsdelivr.net/gh/johnson020202/maoyeye@main/update/",
            "https://raw.githubusercontent.com/johnson020202/maoyeye/main/update/"
    };

    private static final long MAX_ZIP_BYTES = 20L * 1024 * 1024;
    private static final int CONNECT_TIMEOUT = 5000;
    private static final int READ_TIMEOUT = 8000;

    public interface Callback {
        void onUpdated(int version);
    }

    private final Context ctx;
    private final SharedPreferences prefs;

    public HotUpdater(Context context) {
        this.ctx = context.getApplicationContext();
        this.prefs = this.ctx.getSharedPreferences("maoyeye", Context.MODE_PRIVATE);
    }

    /** 当前应该加载的入口地址：有热更新包就用更新包，否则用 APK 内置资源。 */
    public String activeIndexUrl() {
        File web = new File(ctx.getFilesDir(), "web/index.html");
        String base;
        if (web.isFile()) {
            base = "file://" + web.getAbsolutePath();
        } else {
            base = "file:///android_asset/index.html";
        }
        return base + "?v=" + currentVersion();
    }

    public int bundledVersion() {
        try (InputStream in = ctx.getAssets().open("version.json")) {
            JSONObject obj = new JSONObject(readAll(in));
            return obj.optInt("version", 1);
        } catch (Exception e) {
            return 1;
        }
    }

    public int currentVersion() {
        return prefs.getInt("web_version", bundledVersion());
    }

    /** 后台检查更新；失败时静默保留当前版本。 */
    public void checkForUpdate(final Callback callback) {
        new Thread(new Runnable() {
            @Override
            public void run() {
                try {
                    JSONObject remote = null;
                    String base = null;
                    for (String candidate : BASES) {
                        try {
                            remote = fetchJson(candidate + "version.json");
                            base = candidate;
                            break;
                        } catch (Exception e) {
                            Log.w(TAG, "version endpoint failed: " + candidate + " (" + e.getMessage() + ")");
                        }
                    }
                    if (remote == null || base == null) return;

                    int remoteVersion = remote.optInt("version", 0);
                    if (remoteVersion <= currentVersion()) return;

                    File zip = new File(ctx.getCacheDir(), "web-update.zip");
                    download(base + "web.zip", zip);

                    String expected = remote.optString("sha256", "");
                    if (expected.length() > 0 && !expected.equalsIgnoreCase(sha256(zip))) {
                        zip.delete();
                        throw new IOException("sha256 mismatch");
                    }

                    File tmp = new File(ctx.getFilesDir(), "web_tmp");
                    deleteRecursive(tmp);
                    unzip(zip, tmp);
                    if (!new File(tmp, "index.html").isFile()) {
                        deleteRecursive(tmp);
                        zip.delete();
                        throw new IOException("index.html missing in update package");
                    }

                    File web = new File(ctx.getFilesDir(), "web");
                    deleteRecursive(web);
                    if (!tmp.renameTo(web)) {
                        throw new IOException("failed to activate update");
                    }
                    zip.delete();

                    prefs.edit().putInt("web_version", remoteVersion).apply();
                    Log.i(TAG, "hot update applied: v" + remoteVersion);

                    if (callback != null) callback.onUpdated(remoteVersion);
                } catch (Exception e) {
                    Log.w(TAG, "hot update skipped: " + e.getMessage());
                }
            }
        }, "maoyeye-hot-update").start();
    }

    private JSONObject fetchJson(String url) throws IOException {
        HttpURLConnection conn = null;
        try {
            conn = (HttpURLConnection) new URL(url).openConnection();
            conn.setConnectTimeout(CONNECT_TIMEOUT);
            conn.setReadTimeout(READ_TIMEOUT);
            conn.setInstanceFollowRedirects(true);
            conn.setRequestProperty("User-Agent", "maoyeye-android");
            int code = conn.getResponseCode();
            if (code != 200) throw new IOException("HTTP " + code);
            return new JSONObject(readAll(conn.getInputStream()));
        } catch (org.json.JSONException e) {
            throw new IOException("bad version json", e);
        } finally {
            if (conn != null) conn.disconnect();
        }
    }

    private void download(String url, File dest) throws IOException {
        HttpURLConnection conn = null;
        try {
            conn = (HttpURLConnection) new URL(url).openConnection();
            conn.setConnectTimeout(CONNECT_TIMEOUT);
            conn.setReadTimeout(READ_TIMEOUT);
            conn.setInstanceFollowRedirects(true);
            conn.setRequestProperty("User-Agent", "maoyeye-android");
            int code = conn.getResponseCode();
            if (code != 200) throw new IOException("HTTP " + code);

            long declared = conn.getContentLengthLong();
            if (declared > MAX_ZIP_BYTES) throw new IOException("package too large");

            try (InputStream in = conn.getInputStream();
                 FileOutputStream out = new FileOutputStream(dest)) {
                byte[] buf = new byte[16 * 1024];
                long total = 0;
                int n;
                while ((n = in.read(buf)) != -1) {
                    total += n;
                    if (total > MAX_ZIP_BYTES) throw new IOException("package too large");
                    out.write(buf, 0, n);
                }
            }
        } finally {
            if (conn != null) conn.disconnect();
        }
    }

    private static void unzip(File zip, File dest) throws IOException {
        String destRoot = dest.getCanonicalPath() + File.separator;
        long total = 0;
        int entries = 0;

        try (ZipInputStream zis = new ZipInputStream(new FileInputStream(zip))) {
            ZipEntry entry;
            byte[] buf = new byte[16 * 1024];
            while ((entry = zis.getNextEntry()) != null) {
                if (++entries > 200) throw new IOException("too many entries");
                File out = new File(dest, entry.getName());
                if (!out.getCanonicalPath().startsWith(destRoot)) {
                    throw new IOException("illegal zip path");
                }
                if (entry.isDirectory()) {
                    out.mkdirs();
                    continue;
                }
                File parent = out.getParentFile();
                if (parent != null) parent.mkdirs();
                try (FileOutputStream fos = new FileOutputStream(out)) {
                    int n;
                    while ((n = zis.read(buf)) != -1) {
                        total += n;
                        if (total > MAX_ZIP_BYTES) throw new IOException("unzipped data too large");
                        fos.write(buf, 0, n);
                    }
                }
            }
        }
    }

    private static String sha256(File file) throws Exception {
        MessageDigest md = MessageDigest.getInstance("SHA-256");
        try (InputStream in = new FileInputStream(file)) {
            byte[] buf = new byte[16 * 1024];
            int n;
            while ((n = in.read(buf)) != -1) md.update(buf, 0, n);
        }
        StringBuilder sb = new StringBuilder();
        for (byte b : md.digest()) sb.append(String.format("%02x", b));
        return sb.toString();
    }

    private static String readAll(InputStream in) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        byte[] buf = new byte[8 * 1024];
        int n;
        while ((n = in.read(buf)) != -1) out.write(buf, 0, n);
        return out.toString("UTF-8");
    }

    private static void deleteRecursive(File file) {
        if (file == null || !file.exists()) return;
        if (file.isDirectory()) {
            File[] children = file.listFiles();
            if (children != null) {
                for (File child : children) deleteRecursive(child);
            }
        }
        //noinspection ResultOfMethodCallIgnored
        file.delete();
    }
}
