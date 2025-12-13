/**
 * 将 PNG 图标转换为 Mac ICNS 格式
 * 使用 FABO.png 生成多尺寸的 icon.icns 文件
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const sharp = require('sharp');

const inputFile = path.join(__dirname, '../public/FABO.png');
const outputFile = path.join(__dirname, '../build/icon.icns');
const iconsetDir = path.join(__dirname, '../build/icon.iconset');

// Mac ICNS 需要的标准尺寸（按照 Apple 的命名规范）
const sizes = [
  { name: 'icon_16x16.png', size: 16 },
  { name: 'icon_16x16@2x.png', size: 32 },
  { name: 'icon_32x32.png', size: 32 },
  { name: 'icon_32x32@2x.png', size: 64 },
  { name: 'icon_128x128.png', size: 128 },
  { name: 'icon_128x128@2x.png', size: 256 },
  { name: 'icon_256x256.png', size: 256 },
  { name: 'icon_256x256@2x.png', size: 512 },
  { name: 'icon_512x512.png', size: 512 },
  { name: 'icon_512x512@2x.png', size: 1024 },
];

async function convertToIcns() {
  try {
    console.log('正在读取源文件:', inputFile);
    
    // 检查源文件是否存在
    if (!fs.existsSync(inputFile)) {
      throw new Error(`源文件不存在: ${inputFile}`);
    }

    // 确保 build 目录存在
    const buildDir = path.dirname(outputFile);
    if (!fs.existsSync(buildDir)) {
      fs.mkdirSync(buildDir, { recursive: true });
    }

    // 如果 iconset 目录已存在，先删除
    if (fs.existsSync(iconsetDir)) {
      fs.rmSync(iconsetDir, { recursive: true, force: true });
    }
    fs.mkdirSync(iconsetDir, { recursive: true });

    console.log('正在生成多个尺寸的图标...');
    
    // 为每个尺寸生成图片
    await Promise.all(
      sizes.map(async ({ name, size }) => {
        const outputPath = path.join(iconsetDir, name);
        await sharp(inputFile)
          .resize(size, size, {
            fit: 'contain',
            background: { r: 0, g: 0, b: 0, alpha: 0 } // 透明背景
          })
          .png()
          .toFile(outputPath);
      })
    );

    console.log('正在转换为 ICNS 格式...');
    
    // 使用 iconutil 转换为 ICNS
    execSync(`iconutil -c icns "${iconsetDir}" -o "${outputFile}"`, {
      stdio: 'inherit'
    });
    
    // 清理 iconset 目录
    fs.rmSync(iconsetDir, { recursive: true, force: true });
    
    console.log('✓ 成功生成 ICNS 文件:', outputFile);
    console.log(`  包含尺寸: ${sizes.map(s => s.size + 'x' + s.size).join(', ')}px`);
    
  } catch (error) {
    console.error('转换失败:', error);
    
    // 清理临时目录
    if (fs.existsSync(iconsetDir)) {
      fs.rmSync(iconsetDir, { recursive: true, force: true });
    }
    
    process.exit(1);
  }
}

convertToIcns();

