import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import CameraCapture from './components/CameraCapture';
import ImageProcessor from './components/ImageProcessor';
import NestingPanel from './components/NestingPanel';
import LanguageSwitcher from './components/LanguageSwitcher';
import './App.css';

function App() {
  const { t } = useTranslation();
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
      <LanguageSwitcher />
      <header className="app-header">
        <div className="app-header-content">
          <img 
            src="/FABO.png" 
            alt="Logo" 
            className="app-logo"
            onError={(e) => {
              // 如果图片加载失败，隐藏图片元素
              const target = e.target as HTMLImageElement;
              if (target) {
                target.style.display = 'none';
              }
            }}
          />
          <div className="app-title-group">
            <h1 className="app-title-main">FaboGinger</h1>
            <p className="app-title-subtitle">{t('app.subtitle')}</p>
          </div>
        </div>
        <div className="step-indicator">
          <div className={`step ${currentStep === 'capture' ? 'active' : currentStep !== 'capture' ? 'completed' : ''}`}>
            <span>1</span>
            <label>{t('app.step1')}</label>
          </div>
          <div className={`step ${currentStep === 'process' ? 'active' : currentStep === 'nesting' ? 'completed' : ''}`}>
            <span>2</span>
            <label>{t('app.step2')}</label>
          </div>
          <div className={`step ${currentStep === 'nesting' ? 'active' : ''}`}>
            <span>3</span>
            <label>{t('app.step3')}</label>
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
