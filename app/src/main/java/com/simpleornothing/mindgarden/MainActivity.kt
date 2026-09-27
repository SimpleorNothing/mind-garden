package com.simpleornothing.mindgarden

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.webkit.*
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity

class MainActivity : AppCompatActivity() {
    private var fileCallback: ValueCallback<Array<Uri>>? = null
    private val picker = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        val cb=fileCallback; fileCallback=null
        if(result.resultCode==Activity.RESULT_OK) cb?.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(result.resultCode,result.data))
        else cb?.onReceiveValue(null)
    }
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val web=WebView(this)
        setContentView(web)
        web.settings.javaScriptEnabled=true
        web.settings.domStorageEnabled=true
        web.settings.allowFileAccess=true
        web.settings.allowContentAccess=true
        web.settings.mediaPlaybackRequiresUserGesture=false
        web.webViewClient=WebViewClient()
        web.webChromeClient=object:WebChromeClient(){
            override fun onShowFileChooser(view:WebView?, callback:ValueCallback<Array<Uri>>?, params:FileChooserParams?):Boolean{
                fileCallback?.onReceiveValue(null); fileCallback=callback
                val intent=(params?.createIntent() ?: Intent(Intent.ACTION_OPEN_DOCUMENT).apply{type="image/*";addCategory(Intent.CATEGORY_OPENABLE)})
                return try{picker.launch(intent);true}catch(_:Exception){fileCallback=null;false}
            }
        }
        if(savedInstanceState==null) web.loadUrl("file:///android_asset/index.html") else web.restoreState(savedInstanceState)
    }
}
