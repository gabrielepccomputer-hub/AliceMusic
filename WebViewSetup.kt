val webView: WebView = findViewById(R.id.webview)

webView.settings.apply {
    javaScriptEnabled = true
    domStorageEnabled = true
    mediaPlaybackRequiresUserGesture = false
    mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
    allowFileAccess = true
    databaseEnabled = true
    cacheMode = WebSettings.LOAD_DEFAULT
}

webView.webChromeClient = object : WebChromeClient() {
    override fun onPermissionRequest(request: PermissionRequest) {
        request.grant(request.resources)
    }
}

webView.webViewClient = WebViewClient()
webView.loadUrl("file:///android_asset/AliceMusic/index.html")
