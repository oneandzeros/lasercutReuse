import { useEffect, useRef, useState } from 'react';
import './CameraCapture.css';

interface CameraCaptureProps {
  onImageCaptured: (imageData: string) => void;
}

const CameraCapture: React.FC<CameraCaptureProps> = ({ onImageCaptured }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraReady(false);
    setIsCameraActive(false);
  };

  const startCamera = async () => {
    if (isInitializing || isCameraActive) return;
    setIsInitializing(true);
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setIsCameraReady(true);
        setIsCameraActive(true);
      }
    } catch (err) {
      console.error('摄像头打开失败', err);
      setError('无法访问摄像头，请检查权限或使用图片上传');
      stopCamera();
    } finally {
      setIsInitializing(false);
    }
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCapture = () => {
    if (!isCameraActive || !videoRef.current || !canvasRef.current) {
      if (!isCameraActive) {
        setError('请先启用摄像头或上传图片');
      }
      return;
    }
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
        {!isCameraActive ? (
          <button onClick={startCamera} className="btn btn-primary" disabled={isInitializing}>
            {isInitializing ? '正在启动摄像头…' : '启用摄像头'}
          </button>
        ) : (
          <>
            <button onClick={handleCapture} className="btn btn-primary" disabled={!isCameraReady}>
              {isCameraReady ? '拍照识别' : '摄像头准备中…'}
            </button>
            <button onClick={stopCamera} className="btn btn-secondary">
              关闭摄像头
            </button>
          </>
        )}
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
