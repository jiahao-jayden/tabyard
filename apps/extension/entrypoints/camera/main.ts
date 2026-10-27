// 摄像头小窗：以 iframe 嵌入被录制的页面，摄像头权限需事先在授权页授予扩展
const video = document.querySelector('video')!;
const deviceId = new URLSearchParams(location.search).get('device');

void navigator.mediaDevices
  .getUserMedia({
    video: { width: 480, height: 480, ...(deviceId ? { deviceId: { exact: deviceId } } : { facingMode: 'user' }) },
  })
  .then((stream) => {
    video.srcObject = stream;
    window.addEventListener('pagehide', () => stream.getTracks().forEach((t) => t.stop()));
  })
  .catch((error: Error) => console.warn('[tabyard] camera unavailable:', error));
