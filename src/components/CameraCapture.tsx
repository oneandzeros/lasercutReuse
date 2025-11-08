import { useEffect, useRef, useState } from 'react';
import './CameraCapture.css';

interface CameraCaptureProps {
  onImageCaptured: (imageData: string) => void;
}

const CameraCapture: React.FC<CameraCaptureProps> = ({ onImageCaptured }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stream: MediaStream;
    const initCamera = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setIsCameraReady(true);
        }
      } catch (err) {
        console.error('摄像头打开失败', err);
        setError('无法访问摄像头，请检查权限或使用图片上传');
      }
    };

    initCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const handleCapture = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
    onImageCaptured(dataUrl);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === 'string') {
        onImageCaptured(result);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="camera-capture">
      <div className="camera-preview">
        <video ref={videoRef} playsInline muted className="camera-video" />
        <canvas ref={canvasRef} className="capture-canvas" />
      </div>

      <div className="camera-actions">
        <button onClick={handleCapture} className="btn btn-primary" disabled={!isCameraReady}>
          {isCameraReady ? '拍照识别' : '正在初始化摄像头...'}
        </button>
        <label className="btn btn-secondary">
          选择图片上传
          <input type="file" accept="image/*" onChange={handleFileUpload} hidden />
        </label>
      </div>

      {error && <p className="camera-error">{error}</p>}
    </div>
  );
};

export default CameraCapture;
