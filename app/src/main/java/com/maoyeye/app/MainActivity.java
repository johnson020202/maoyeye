package com.maoyeye.app;

import android.app.Activity;
import android.graphics.Color;
import android.graphics.Insets;
import android.graphics.drawable.ColorDrawable;
import android.os.Build;
import android.os.Bundle;
import android.view.DisplayCutout;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.Toast;

public class MainActivity extends Activity {

    private static final int PAPER = 0xFFF2E8D5;

    private WebView webView;
    private HotUpdater updater;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        configureWindow();
        updater = new HotUpdater(this);

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(PAPER);
        // 资源高度作为兜底：即使系统没有派发 insets，也不会把内容顶到状态栏下面
        root.setPadding(0, systemDimen("status_bar_height"), 0, systemDimen("navigation_bar_height"));

        webView = new WebView(this);
        webView.setBackgroundColor(PAPER);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(false);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setTextZoom(100);
        if (Build.VERSION.SDK_INT >= 26) {
            settings.setSafeBrowsingEnabled(false);
        }

        webView.setWebViewClient(new WebViewClient());
        webView.setOverScrollMode(View.OVER_SCROLL_NEVER);

        root.addView(webView, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT));

        setContentView(root);

        // 必须在 setContentView 之后：Android 17 上 DecorView 尚未创建时
        // PhoneWindow.getInsetsController() 会抛 NPE。
        applySystemBarAppearance();

        root.setOnApplyWindowInsetsListener(new View.OnApplyWindowInsetsListener() {
            @Override
            public WindowInsets onApplyWindowInsets(View v, WindowInsets insets) {
                int top = 0;
                int bottom = 0;
                if (Build.VERSION.SDK_INT >= 30) {
                    Insets bars = insets.getInsets(
                            WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
                    top = bars.top;
                    bottom = bars.bottom;
                } else {
                    top = insets.getSystemWindowInsetTop();
                    bottom = insets.getSystemWindowInsetBottom();
                    if (Build.VERSION.SDK_INT >= 28) {
                        DisplayCutout cutout = insets.getDisplayCutout();
                        if (cutout != null) {
                            top = Math.max(top, cutout.getSafeInsetTop());
                        }
                    }
                }
                if (top > 0 || bottom > 0) {
                    v.setPadding(0, top, 0, bottom);
                }
                return insets;
            }
        });
        root.requestApplyInsets();

        webView.loadUrl(updater.activeIndexUrl());
        checkHotUpdate();
    }

    private void configureWindow() {
        getWindow().setBackgroundDrawable(new ColorDrawable(PAPER));
        if (Build.VERSION.SDK_INT >= 21) {
            getWindow().setStatusBarColor(Color.TRANSPARENT);
            getWindow().setNavigationBarColor(Color.TRANSPARENT);
        }
        if (Build.VERSION.SDK_INT >= 29) {
            // 关闭系统给透明导航栏/状态栏自动加的对比度蒙层，
            // 否则手势条区域会比网页背景暗一截。
            getWindow().setNavigationBarContrastEnforced(false);
            getWindow().setStatusBarContrastEnforced(false);
        }

        if (Build.VERSION.SDK_INT >= 30) {
            getWindow().setDecorFitsSystemWindows(false);
        } else {
            int flags = View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                    | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                    | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                    | View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
            if (Build.VERSION.SDK_INT >= 26) {
                flags |= View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
            }
            getWindow().getDecorView().setSystemUiVisibility(flags);
        }
    }

    private void applySystemBarAppearance() {
        if (Build.VERSION.SDK_INT < 30) return;
        WindowInsetsController controller = getWindow().getInsetsController();
        if (controller == null) {
            controller = getWindow().getDecorView().getWindowInsetsController();
        }
        if (controller != null) {
            int mask = WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS
                    | WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS;
            controller.setSystemBarsAppearance(mask, mask);
        }
    }

    private int systemDimen(String name) {
        int id = getResources().getIdentifier(name, "dimen", "android");
        return id > 0 ? getResources().getDimensionPixelSize(id) : 0;
    }

    private void checkHotUpdate() {
        updater.checkForUpdate(new HotUpdater.Callback() {
            @Override
            public void onUpdated(final int version) {
                runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        if (webView == null) return;
                        webView.loadUrl(updater.activeIndexUrl());
                        Toast.makeText(MainActivity.this,
                                "内容已热更新到 v" + version, Toast.LENGTH_SHORT).show();
                    }
                });
            }
        });
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }
}
