// Configurazione minima della WebView per far funzionare AliceMusic
// (audio YouTube, ricerca via fetch, cronologia via localStorage)

val webView: WebView = findViewById(R.id.webview)

webView.settings.apply {
    javaScriptEnabled = true                 // serve per tutto app.js
    domStorageEnabled = true                 // SENZA QUESTO la cronologia (localStorage) non si salva
    mediaPlaybackRequiresUserGesture = false  // altrimenti l'audio non parte mai in automatico
    mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW // va bene, è già tutto https
    allowFileAccess = true                   // se carichi i file da assets/ o storage locale
    databaseEnabled = true
    cacheMode = WebSettings.LOAD_DEFAULT
}

// Necessario per l'audio del player YouTube: la WebView deve sapere
// come gestire i permessi media (altrimenti alcuni dispositivi bloccano il suono)
webView.webChromeClient = object : WebChromeClient() {
    override fun onPermissionRequest(request: PermissionRequest) {
        request.grant(request.resources)
    }
}

webView.webViewClient = WebViewClient() // per restare dentro l'app invece di aprire Chrome

// Carica il file locale (se l'hai messo dentro app/src/main/assets/AliceMusic/)
webView.loadUrl("file:///android_asset/AliceMusic/index.html")
