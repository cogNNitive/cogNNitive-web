#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function isDepInstalled(pkgName) {
  try {
    require.resolve(pkgName, { paths: [__dirname] });
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const inputDir = args[0] || './sources/original/photos';
  const outputDir = args[1] || './sources/processed/photos';

  if (!fs.existsSync(inputDir)) {
    console.error(`Input directory does not exist: ${inputDir}`);
    process.exit(1);
  }

  if (!isDepInstalled('sharp')) {
    console.log('Installing "sharp" dependency locally...');
    try {
      execSync('npm install sharp', { cwd: path.resolve(__dirname, '..'), stdio: 'inherit' });
      console.log('"sharp" installed successfully.');
    } catch (err) {
      console.error(`Failed to install sharp: ${err.message}`);
      process.exit(1);
    }
  }

  const sharp = require('sharp');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const files = fs.readdirSync(inputDir).filter(f => /\.(jpg|jpeg|png|webp|gif)$/i.test(f));
  console.log(`Found ${files.length} images to process from ${inputDir}`);

  for (const file of files) {
    const inputPath = path.join(inputDir, file);
    const outputPath = path.join(outputDir, file);
    const ext = path.extname(file).toLowerCase();

    try {
      let pipeline = sharp(inputPath)
        .resize(768, 768, { fit: 'inside', withoutEnlargement: true });

      if (ext === '.png') {
        pipeline = pipeline.png({ quality: 80 });
      } else if (ext === '.webp') {
        pipeline = pipeline.webp({ quality: 80 });
      } else if (ext === '.gif') {
        pipeline = pipeline.gif();
      } else {
        pipeline = pipeline.jpeg({ quality: 80 });
      }

      await pipeline.toFile(outputPath);
      console.log(`Optimized: ${file}`);
    } catch (err) {
      console.error(`Failed to optimize ${file}: ${err.message}`);
    }
  }

  console.log('Batch image processing completed.');
}

main().catch(console.error);
