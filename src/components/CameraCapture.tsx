import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import './CameraCapture.css';

interface CameraCaptureProps {
  onImageCaptured: (imageData: string) => void;
}

const CameraCapture: React.FC<CameraCaptureProps> = ({ onImageCaptured }) => {
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageRotation, setImageRotation] = useState(0);
  const [capturedImageData, setCapturedImageData] = useState<string | null>(null);
  const [originalImageData, setOriginalImageData] = useState<string | null>(null);

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
      setError(t('cameraCapture.error.cameraAccess', { defaultValue: '无法访问摄像头，请检查权限或使用图片上传' }));
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

  const rotateImage = (imageData: string, angle: number): Promise<string> => {
    return new Promise<string>((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(imageData);
          return;
        }

        // 计算旋转后的画布尺寸
        let width = img.width;
        let height = img.height;
        if (angle === 90 || angle === 270) {
          [width, height] = [height, width];
        }

        canvas.width = width;
        canvas.height = height;

        // 应用旋转
        ctx.translate(width / 2, height / 2);
        ctx.rotate((angle * Math.PI) / 180);
        ctx.drawImage(img, -img.width / 2, -img.height / 2);

        resolve(canvas.toDataURL('image/jpeg', 0.95));
      };
      img.onerror = () => resolve(imageData);
      img.src = imageData;
    });
  };

  const handleCapture = async () => {
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
    
    // 保存原始图片
    setOriginalImageData(dataUrl);
    
    // 应用当前旋转角度
    const rotatedDataUrl = await rotateImage(dataUrl, imageRotation);
    setCapturedImageData(rotatedDataUrl);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const result = reader.result;
      if (typeof result === 'string') {
        // 保存原始图片
        setOriginalImageData(result);
        
        // 应用当前旋转角度
        const rotatedDataUrl = await rotateImage(result, imageRotation);
        setCapturedImageData(rotatedDataUrl);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRotateLeft = async () => {
    const newRotation = (imageRotation - 90 + 360) % 360;
    setImageRotation(newRotation);
    if (originalImageData) {
      // 基于原始图片和新的旋转角度生成旋转后的图片
      const rotatedDataUrl = await rotateImage(originalImageData, newRotation);
      setCapturedImageData(rotatedDataUrl);
    }
  };

  const handleRotateRight = async () => {
    const newRotation = (imageRotation + 90) % 360;
    setImageRotation(newRotation);
    if (originalImageData) {
      // 基于原始图片和新的旋转角度生成旋转后的图片
      const rotatedDataUrl = await rotateImage(originalImageData, newRotation);
      setCapturedImageData(rotatedDataUrl);
    }
  };

  const handleConfirmImage = () => {
    if (capturedImageData) {
      onImageCaptured(capturedImageData);
    }
  };

  return (
    <div className="camera-capture">
      <div className="camera-preview">
        <video ref={videoRef} playsInline muted className="camera-video" />
        <canvas ref={canvasRef} className="capture-canvas" />
        {capturedImageData && (
          <img 
            src={capturedImageData} 
            alt="已拍摄" 
            style={{ 
              width: '100%', 
              height: '100%', 
              objectFit: 'contain',
              position: 'absolute',
              top: 0,
              left: 0
            }} 
          />
        )}
      </div>

      <div className="camera-actions">
        {!capturedImageData ? (
          <>
            {!isCameraActive ? (
              <button onClick={startCamera} className="btn btn-primary" disabled={isInitializing}>
                {isInitializing ? t('cameraCapture.initializing', { defaultValue: '正在启动摄像头…' }) : t('cameraCapture.enableCamera', { defaultValue: '启用摄像头' })}
              </button>
            ) : (
              <>
                <button onClick={handleCapture} className="btn btn-primary" disabled={!isCameraReady}>
                  {isCameraReady ? t('cameraCapture.captureButton') : t('cameraCapture.preparing', { defaultValue: '摄像头准备中…' })}
                </button>
                <button onClick={stopCamera} className="btn btn-secondary">
                  {t('cameraCapture.stopCamera', { defaultValue: '关闭摄像头' })}
                </button>
              </>
            )}
            <label className="btn btn-secondary">
              {t('cameraCapture.uploadButton')}
              <input type="file" accept="image/*" onChange={handleFileUpload} hidden />
            </label>
          </>
        ) : (
          <>
            <button onClick={handleConfirmImage} className="btn btn-primary">
              {t('cameraCapture.confirmImage', { defaultValue: '确认使用此图片' })}
            </button>
            <button onClick={handleRotateLeft} className="btn btn-secondary">
              {t('cameraCapture.rotateLeft')}
            </button>
            <button onClick={handleRotateRight} className="btn btn-secondary">
              {t('cameraCapture.rotateRight')}
            </button>
            <button 
              onClick={() => {
                setCapturedImageData(null);
                setOriginalImageData(null);
                setImageRotation(0);
              }} 
              className="btn btn-secondary"
            >
              {t('cameraCapture.reselect', { defaultValue: '重新选择' })}
            </button>
          </>
        )}
      </div>

      {error && <p className="camera-error">{error}</p>}
    </div>
  );
};

export default CameraCapture;
