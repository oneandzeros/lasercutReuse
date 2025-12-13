/**
 * 将 PNG 图标转换为 Windows ICO 格式
 * 使用 FABO.png 生成多尺寸的 icon.ico 文件
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const toIco = require('to-ico');

const inputFile = path.join(__dirname, '../public/FABO.png');
const outputFile = path.join(__dirname, '../build/icon.ico');

// Windows ICO 需要的标准尺寸
const sizes = [16, 32, 48, 64, 128, 256];

async function convertToIco() {
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

    console.log('正在生成多个尺寸的图标...');
    
    // 为每个尺寸生成图片
    const buffers = await Promise.all(
      sizes.map(async (size) => {
        const buffer = await sharp(inputFile)
          .resize(size, size, {
            fit: 'contain',
            background: { r: 0, g: 0, b: 0, alpha: 0 } // 透明背景
          })
          .png()
          .toBuffer();
        return buffer;
      })
    );

    console.log('正在转换为 ICO 格式...');
    
    // 转换为 ICO 格式
    const icoBuffer = await toIco(buffers);
    
    // 保存文件
    fs.writeFileSync(outputFile, icoBuffer);
    
    console.log('✓ 成功生成 ICO 文件:', outputFile);
    console.log(`  包含尺寸: ${sizes.join(', ')}px`);
    
  } catch (error) {
    console.error('转换失败:', error);
    process.exit(1);
  }
}

convertToIco();





