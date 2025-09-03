#!/usr/bin/env node

/**
 * Script to download Google Fonts for offline usage
 * This ensures the app works in air-gapped environments
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const fontDir = path.join(__dirname, '../frontend/public/fonts');

// Ensure fonts directory exists
if (!fs.existsSync(fontDir)) {
  fs.mkdirSync(fontDir, { recursive: true });
}

// Google Fonts CSS URLs for Geist fonts
const fontUrls = [
  'https://fonts.googleapis.com/css2?family=Geist:wght@100;200;300;400;500;600;700;800;900&display=swap',
  'https://fonts.googleapis.com/css2?family=Geist+Mono:wght@100;200;300;400;500;600;700;800;900&display=swap'
];

async function downloadFile(url, filepath) {
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download ${url}: ${response.statusCode}`));
        return;
      }
      
      const file = fs.createWriteStream(filepath);
      response.pipe(file);
      
      file.on('finish', () => {
        file.close();
        console.log(`Downloaded: ${filepath}`);
        resolve();
      });
      
      file.on('error', reject);
    }).on('error', reject);
  });
}

async function downloadFontFiles(cssUrl, fontFamily) {
  return new Promise((resolve, reject) => {
    https.get(cssUrl, (response) => {
      let data = '';
      
      response.on('data', (chunk) => {
        data += chunk;
      });
      
      response.on('end', async () => {
        try {
          // Extract font URLs from CSS - Updated regex for TTF and WOFF2
          const fontUrlRegex = /url\((https:\/\/[^)]+\.(ttf|woff2?))\)/g;
          const fontUrls = [];
          let match;
          
          while ((match = fontUrlRegex.exec(data)) !== null) {
            fontUrls.push(match[1]);
          }
          
          console.log(`Found ${fontUrls.length} font files for ${fontFamily}`);
          
          // Download each font file
          for (let i = 0; i < fontUrls.length; i++) {
            const fontUrl = fontUrls[i];
            const extension = fontUrl.includes('.woff2') ? 'woff2' : fontUrl.includes('.woff') ? 'woff' : 'ttf';
            const fileName = `${fontFamily.toLowerCase().replace(/\s+/g, '-')}-${i + 1}.${extension}`;
            const filePath = path.join(fontDir, fileName);
            
            try {
              await downloadFile(fontUrl, filePath);
            } catch (error) {
              console.error(`Failed to download ${fontUrl}:`, error.message);
            }
          }
          
          // Create local CSS file with proper file extensions
          const localCss = data.replace(/https:\/\/fonts\.gstatic\.com\/[^)]+/g, (match) => {
            const index = fontUrls.indexOf(match);
            if (index !== -1) {
              const extension = match.includes('.woff2') ? 'woff2' : match.includes('.woff') ? 'woff' : 'ttf';
              return `/fonts/${fontFamily.toLowerCase().replace(/\s+/g, '-')}-${index + 1}.${extension}`;
            }
            return match;
          });
          
          const cssPath = path.join(fontDir, `${fontFamily.toLowerCase().replace(/\s+/g, '-')}.css`);
          fs.writeFileSync(cssPath, localCss);
          console.log(`Created local CSS: ${cssPath}`);
          
          resolve();
        } catch (error) {
          reject(error);
        }
      });
    }).on('error', reject);
  });
}

async function main() {
  try {
    console.log('Downloading Geist fonts for offline usage...');
    
    await downloadFontFiles(fontUrls[0], 'Geist');
    await downloadFontFiles(fontUrls[1], 'Geist Mono');
    
    console.log('Font download completed!');
    console.log('Fonts are now available in frontend/public/fonts/');
    console.log('You can now use the app in air-gapped environments.');
    
  } catch (error) {
    console.error('Error downloading fonts:', error);
    process.exit(1);
  }
}

main();
