import { useState } from 'react';
import CameraCapture from './components/CameraCapture';
import ImageProcessor from './components/ImageProcessor';
import NestingPanel from './components/NestingPanel';
import './App.css';

function App() {
  const [currentStep, setCurrentStep] = useState<'capture' | 'process' | 'nesting'>('capture');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [materialSvg, setMaterialSvg] = useState<string | null>(null);
  const [actualSize, setActualSize] = useState<{ width: number; height: number } | undefined>();

  const handleImageCaptured = (imageData: string) => {
    setCapturedImage(imageData);
    setCurrentStep('process');
  };

  const handleSvgGenerated = (svg: string, size?: { width: number; height: number }) => {
    setMaterialSvg(svg);
    setActualSize(size);
    setCurrentStep('nesting');
  };

  const handleBack = () => {
    if (currentStep === 'process') {
      setCurrentStep('capture');
      setCapturedImage(null);
      setMaterialSvg(null);
    } else if (currentStep === 'nesting') {
      setCurrentStep('process');
    }
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>激光切割余料再利用工具</h1>
        <div className="step-indicator">
          <div className={`step ${currentStep === 'capture' ? 'active' : currentStep !== 'capture' ? 'completed' : ''}`}>
            <span>1</span>
            <label>拍摄余料</label>
          </div>
          <div className={`step ${currentStep === 'process' ? 'active' : currentStep === 'nesting' ? 'completed' : ''}`}>
            <span>2</span>
            <label>处理图像</label>
          </div>
          <div className={`step ${currentStep === 'nesting' ? 'active' : ''}`}>
            <span>3</span>
            <label>排版优化</label>
          </div>
        </div>
      </header>

      <main className="app-main">
        {currentStep === 'capture' && <CameraCapture onImageCaptured={handleImageCaptured} />}
        {currentStep === 'process' && capturedImage && (
          <ImageProcessor
            imageData={capturedImage}
            onSvgGenerated={handleSvgGenerated}
            onBack={handleBack}
          />
        )}
        {currentStep === 'nesting' && materialSvg && (
          <NestingPanel
            materialSvg={materialSvg}
            actualSize={actualSize}
            onBack={handleBack}
          />
        )}
      </main>
    </div>
  );
}

export default App;
