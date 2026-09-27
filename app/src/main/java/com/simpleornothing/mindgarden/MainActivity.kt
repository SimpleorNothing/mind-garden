package com.simpleornothing.mindgarden

import android.app.Activity
import android.content.Intent
import android.graphics.*
import android.net.Uri
import android.os.Bundle
import android.provider.Settings
import android.view.*
import android.widget.*
import androidx.appcompat.app.AppCompatActivity
import java.time.LocalDateTime
import kotlin.math.*

class MainActivity : AppCompatActivity() {
    private lateinit var garden: GardenView
    private lateinit var time: SeekBar
    private lateinit var clock: TextView
    override fun onCreate(b: Bundle?) {
        super.onCreate(b)
        val root=LinearLayout(this).apply { orientation=LinearLayout.VERTICAL; setPadding(28,28,28,28); setBackgroundColor(Color.rgb(238,240,232)) }
        root.addView(TextView(this).apply { text="Mind Garden"; textSize=36f; gravity=Gravity.CENTER; setTextColor(Color.rgb(38,54,43)) })
        root.addView(TextView(this).apply { text="화면을 내려놓으면, 정원이 자랍니다."; textSize=16f; gravity=Gravity.CENTER; setPadding(0,0,0,20) })
        garden=GardenView(this)
        root.addView(garden,LinearLayout.LayoutParams(-1,0,1f))
        val row=LinearLayout(this).apply { gravity=Gravity.CENTER_VERTICAL }
        clock=TextView(this).apply { textSize=24f; setTypeface(null,1) }
        time=SeekBar(this).apply { max=1439; progress=LocalDateTime.now().hour*60+LocalDateTime.now().minute }
        row.addView(clock,LinearLayout.LayoutParams(120,-2)); row.addView(time,LinearLayout.LayoutParams(0,-2,1f)); root.addView(row)
        val weather=LinearLayout(this)
        listOf("☀ 맑음","☁ 흐림","🌧 비").forEachIndexed { i,s -> weather.addView(Button(this).apply { text=s; setOnClickListener{garden.weather=i;garden.invalidate()} },LinearLayout.LayoutParams(0,-2,1f)) }
        root.addView(weather)
        val actions=LinearLayout(this)
        actions.addView(Button(this).apply { text="🏠 배경 변경";setOnClickListener{startActivityForResult(Intent(Intent.ACTION_OPEN_DOCUMENT).apply{type="image/*";addCategory(Intent.CATEGORY_OPENABLE)},7)}},LinearLayout.LayoutParams(0,-2,1f))
        actions.addView(Button(this).apply { text="현재시간";setOnClickListener{val n=LocalDateTime.now();time.progress=n.hour*60+n.minute}},LinearLayout.LayoutParams(0,-2,1f))
        root.addView(actions)
        root.addView(TextView(this).apply { text="도곡1동 · 남향 거실\n오전: 태양 왼쪽 → 그림자 우하향  |  오후: 태양 오른쪽 → 그림자 좌하향"; textSize=13f; setPadding(4,12,4,8) })
        setContentView(root)
        time.setOnSeekBarChangeListener(object:SeekBar.OnSeekBarChangeListener{override fun onProgressChanged(s:SeekBar?,p:Int,f:Boolean){garden.minute=p;clock.text="%02d:%02d".format(p/60,p%60);garden.invalidate()};override fun onStartTrackingTouch(s:SeekBar?){};override fun onStopTrackingTouch(s:SeekBar?){}})
        time.progress=time.progress
        val saved=getSharedPreferences("garden",0).getString("bg",null); if(saved!=null) garden.setPhoto(Uri.parse(saved))
    }
    override fun onActivityResult(r:Int,c:Int,d:Intent?){super.onActivityResult(r,c,d);if(r==7&&c==Activity.RESULT_OK){d?.data?.let{try{contentResolver.takePersistableUriPermission(it,Intent.FLAG_GRANT_READ_URI_PERMISSION)}catch(_:Exception){};getSharedPreferences("garden",0).edit().putString("bg",it.toString()).apply();garden.setPhoto(it)}}}
}

class GardenView(c:android.content.Context):View(c){
    var minute=720; var weather=0; private var photo:Bitmap?=null
    private val p=Paint(Paint.ANTI_ALIAS_FLAG); private val rise=378; private val set=1104
    fun setPhoto(u:Uri){try{c.contentResolver.openInputStream(u)?.use{photo=BitmapFactory.decodeStream(it)};invalidate()}catch(_:Exception){}}
    override fun onDraw(cv:Canvas){super.onDraw(cv);val w=width.toFloat();val h=height.toFloat();p.color=Color.rgb(190,202,199);cv.drawRoundRect(0f,0f,w,h,38f,38f,p)
        photo?.let{val s=max(w/it.width,h/it.height);val dw=it.width*s;val dh=it.height*s;val dst=RectF((w-dw)/2,(h-dh)/2,(w+dw)/2,(h+dh)/2);p.colorFilter=ColorMatrixColorFilter(ColorMatrix().apply{setSaturation(.86f)});cv.drawBitmap(it,null,dst,p);p.colorFilter=null}
        val day=minute in rise..set; val solarNoon=(rise+set)/2f; val side=((minute-solarNoon)/((set-rise)/2f)).coerceIn(-1f,1f);val prog=((minute-rise)/(set-rise).toFloat()).coerceIn(0f,1f);val elev=if(day) sin(Math.PI*prog).toFloat() else 0f
        if(!day){p.color=Color.argb(145,13,30,55);cv.drawRoundRect(0f,0f,w,h,38f,38f,p)}
        if(weather>0){p.color=Color.argb(if(weather==2)105 else 70,90,100,105);cv.drawRoundRect(0f,0f,w,h,38f,38f,p)}
        if(day&&weather==0){p.color=Color.rgb(255,190,45);cv.drawCircle(w*(.08f+.84f*prog),h*(.40f-.29f*elev),14f,p)}
        val px=w*.72f;val py=h*.79f
        val shadowAlpha=if(!day||weather==2)0 else if(weather==1)28 else 105
        if(shadowAlpha>0){val angle=Math.toRadians((90+62*side).toDouble());val len=55f+(125f*abs(side));cv.save();cv.translate(px,py+42);cv.rotate(Math.toDegrees(angle).toFloat());p.color=Color.argb(shadowAlpha,25,31,26);cv.drawOval(RectF(0f,-8f,len,8f),p);cv.restore()}
        p.color=Color.rgb(48,55,47);cv.drawPath(Path().apply{moveTo(px-25,py);lineTo(px+25,py);lineTo(px+18,py+52);lineTo(px-18,py+52);close()},p)
        p.strokeWidth=8f;p.color=Color.rgb(69,130,70);cv.drawLine(px,py,px,py-55,p)
        p.color=Color.rgb(86,174,73);cv.drawOval(RectF(px-42,py-68,px,py-42),p);cv.drawOval(RectF(px,py-74,px+42,py-46),p)
    }
}
