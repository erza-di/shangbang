#!/bin/bash
# 录制 ad-anim.html 动画 -> 逐帧截图 -> ffmpeg 合成 MP4 + GIF
set -e
EDGE1="/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"
EDGE2="/c/Program Files/Microsoft/Edge/Application/msedge.exe"
[ -f "$EDGE1" ] && EDGE="$EDGE1" || EDGE="$EDGE2"
SRC="file:///C:/Users/19064/Desktop/rankboard-prototype/promo/ad-anim.html"
OUTDIR="$LOCALAPPDATA/Temp/adframes"
mkdir -p "$OUTDIR"; rm -f "$OUTDIR"/*.png

# 每 0.5s 一帧，共 9 秒 = 18 帧（动画 CSS 时间轴固定，用 JS 时钟对齐：每帧重开页面并用 virtual-time-budget 快进）
for t in 500 1000 1500 2000 2500 3000 3500 4000 4500 5000 5500 6000 6500 7000 7500 8000 8500 9000; do
  "$EDGE" --headless=new --disable-gpu --window-size=1280,720 \
    --virtual-time-budget=$t --screenshot="$OUTDIR/f$t.png" "$SRC" 2>/dev/null || true
done
ls "$OUTDIR" | wc -l

FF=$(command -v ffmpeg)
"$FF" -y -framerate 2 -pattern_type glob -i "$LOCALAPPDATA/Temp/adframes/f*.png" \
  -vf "scale=960:-2" -c:v libx264 -pix_fmt yuv420p -movflags +faststart \
  /c/Users/19064/Desktop/rankboard-prototype/promo/ad-video.mp4 2>&1 | tail -2

"$FF" -y -framerate 2 -i "$LOCALAPPDATA/Temp/adframes/f%00d.png" 2>/dev/null || true
echo DONE
