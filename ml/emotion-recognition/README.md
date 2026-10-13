# จำแนกอารมณ์จากใบหน้า (Facial Emotion Recognition)

Notebook สำหรับ Google Colab: สร้าง/นำเข้าชุดข้อมูลภาพใบหน้า 7 อารมณ์ แล้วส่งเข้าโมเดล CNN

- `facial_emotion_dataset.ipynb` — นำเข้า FER-2013 จาก Kaggle, สร้างภาพเองจากเว็บแคม/อัปโหลด (ตรวจจับ + ครอปใบหน้า),
  EDA, ทำความสะอาดข้อมูล, `tf.data` + augmentation + class weight, train baseline CNN, ประเมินผล, บันทึกลง Google Drive

## วิธีเปิดใน Colab
1. ไปที่ https://colab.research.google.com → **File → Upload notebook** แล้วเลือกไฟล์ `.ipynb` นี้
   (หรือแท็บ **GitHub** แล้ววาง URL ของไฟล์นี้ใน repo)
2. **Runtime → Change runtime type → T4 GPU**
3. **Runtime → Run all** (ส่วนเว็บแคม/อัปโหลดเป็นทางเลือก — เอา `#` หน้าคำสั่งออกเมื่อต้องการใช้)
