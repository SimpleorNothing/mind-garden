package com.simpleornothing.mindgarden

import android.app.Activity
import android.content.Intent
import android.graphics.Color
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.provider.MediaStore
import android.view.Gravity
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import java.util.Locale

class MainActivity : Activity(), SensorEventListener {
    private lateinit var sensorManager: SensorManager
    private var lightSensor: Sensor? = null
    private var currentLux = 0f
    private var running = false
    private var startedAt = 0L
    private var earnedMs = 0L
    private lateinit var status: TextView
    private lateinit var timer: TextView
    private lateinit var plant: TextView
    private lateinit var action: Button
    private val handler = Handler(Looper.getMainLooper())
    private val prefs by lazy { getSharedPreferences("garden", MODE_PRIVATE) }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        sensorManager = getSystemService(SENSOR_SERVICE) as SensorManager
        lightSensor = sensorManager.getDefaultSensor(Sensor.TYPE_LIGHT)
        earnedMs = prefs.getLong("sunlight", 0L)
        buildUi()
        handler.post(tick)
    }

    private fun buildUi() {
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_HORIZONTAL
            setPadding(48, 72, 48, 48)
            setBackgroundColor(Color.rgb(243, 240, 231))
        }
        val title = TextView(this).apply { text = "Mind Garden"; textSize = 30f; setTextColor(Color.rgb(45, 62, 48)) }
        val motto = TextView(this).apply { text = "화면을 내려놓으면, 정원이 자랍니다."; textSize = 16f; setPadding(0, 12, 0, 42) }
        plant = TextView(this).apply { textSize = 92f; gravity = Gravity.CENTER }
        status = TextView(this).apply { textSize = 17f; gravity = Gravity.CENTER; setPadding(0, 24, 0, 10) }
        timer = TextView(this).apply { textSize = 38f; gravity = Gravity.CENTER; setPadding(0, 10, 0, 28) }
        action = Button(this).apply { text = "햇살 휴식 시작"; setOnClickListener { toggleRest() } }
        val photo = Button(this).apply {
            text = "우리 집 배경 선택"
            setOnClickListener {
                val intent = Intent(Intent.ACTION_PICK, MediaStore.Images.Media.EXTERNAL_CONTENT_URI)
                startActivityForResult(intent, 10)
            }
        }
        val hint = TextView(this).apply {
            text = "직사광선은 피하고, 창가처럼 밝고 시원한 곳에 휴대폰을 내려놓으세요.\n밝은 환경에서 화면을 사용하지 않는 시간이 식물의 성장으로 이어집니다."
            textSize = 14f
            gravity = Gravity.CENTER
            setPadding(0, 28, 0, 0)
        }
        listOf(title, motto, plant, status, timer, action, photo, hint).forEach {
            root.addView(it, LinearLayout.LayoutParams(-1, -2).apply { bottomMargin = 12 })
        }
        setContentView(root)
        updateUi()
    }

    private fun toggleRest() {
        if (!running) {
            running = true
            startedAt = SystemClock.elapsedRealtime()
            action.text = "휴식 종료"
        } else {
            if (currentLux >= 1000f) earnedMs += SystemClock.elapsedRealtime() - startedAt
            prefs.edit().putLong("sunlight", earnedMs).apply()
            running = false
            action.text = "햇살 휴식 시작"
        }
        updateUi()
    }

    private val tick = object : Runnable {
        override fun run() {
            updateUi()
            handler.postDelayed(this, 1000)
        }
    }

    private fun updateUi() {
        val session = if (running && currentLux >= 1000f) SystemClock.elapsedRealtime() - startedAt else 0L
        val total = earnedMs + session
        timer.text = String.format(Locale.KOREA, "%02d:%02d", total / 60000, (total / 1000) % 60)
        status.text = if (running) {
            if (currentLux >= 1000f) "광합성 중 · " + currentLux.toInt() + " lux"
            else "밝은 곳을 찾는 중 · " + currentLux.toInt() + " lux"
        } else "오늘의 햇살 휴식"
        plant.text = growthPlant(total)
    }

    private fun growthPlant(ms: Long): String = when {
        ms >= 60 * 60 * 1000L -> "🌳"
        ms >= 30 * 60 * 1000L -> "🪴"
        ms >= 10 * 60 * 1000L -> "🌿"
        else -> "🌱"
    }

    override fun onResume() {
        super.onResume()
        lightSensor?.also { sensorManager.registerListener(this, it, SensorManager.SENSOR_DELAY_NORMAL) }
    }

    override fun onPause() {
        super.onPause()
        sensorManager.unregisterListener(this)
    }

    override fun onSensorChanged(event: SensorEvent) {
        if (event.sensor.type == Sensor.TYPE_LIGHT) {
            currentLux = event.values[0]
            updateUi()
        }
    }

    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) = Unit

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == 10 && resultCode == RESULT_OK && data?.data != null) {
            prefs.edit().putString("roomUri", data.data.toString()).apply()
            Toast.makeText(this, "우리 집 배경을 저장했습니다.", Toast.LENGTH_SHORT).show()
        }
    }
}
