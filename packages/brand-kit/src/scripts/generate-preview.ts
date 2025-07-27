import fs from 'fs'
import path from 'path'
import colorsData from '../colors.json'

const EXPORTS_DIR = path.join(__dirname, '../../exports')

function generateHTMLPreview() {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Promptliano Brand Colors</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      color: #333;
      background: #f8f9fa;
      padding: 40px 20px;
    }
    
    .container {
      max-width: 1200px;
      margin: 0 auto;
    }
    
    h1 {
      font-size: 48px;
      margin-bottom: 16px;
      background: linear-gradient(135deg, #9333ea, #3b82f6);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    
    .subtitle {
      font-size: 20px;
      color: #666;
      margin-bottom: 48px;
    }
    
    .section {
      margin-bottom: 64px;
    }
    
    h2 {
      font-size: 32px;
      margin-bottom: 24px;
      color: #1a1a1a;
    }
    
    .color-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
      gap: 24px;
      margin-bottom: 32px;
    }
    
    .color-card {
      background: white;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      transition: transform 0.2s, box-shadow 0.2s;
    }
    
    .color-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
    }
    
    .color-preview {
      height: 140px;
      position: relative;
      cursor: pointer;
    }
    
    .color-preview:hover::after {
      content: 'Click to copy';
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(0, 0, 0, 0.8);
      color: white;
      font-size: 14px;
      font-weight: 500;
    }
    
    .color-info {
      padding: 20px;
    }
    
    .color-name {
      font-size: 18px;
      font-weight: 600;
      margin-bottom: 8px;
    }
    
    .color-values {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin-bottom: 12px;
    }
    
    .color-value {
      font-family: 'SF Mono', Monaco, monospace;
      font-size: 13px;
      padding: 6px 10px;
      background: #f5f5f5;
      border-radius: 6px;
      cursor: pointer;
      transition: background 0.2s;
    }
    
    .color-value:hover {
      background: #e8e8e8;
    }
    
    .color-usage {
      font-size: 13px;
      color: #666;
      line-height: 1.5;
    }
    
    .gradient-card {
      background: white;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      margin-bottom: 24px;
    }
    
    .gradient-preview {
      height: 100px;
    }
    
    .gradient-info {
      padding: 20px;
    }
    
    .gradient-name {
      font-size: 18px;
      font-weight: 600;
      margin-bottom: 8px;
    }
    
    .gradient-usage {
      font-size: 14px;
      color: #666;
    }
    
    .copy-notification {
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: #22c55e;
      color: white;
      padding: 12px 24px;
      border-radius: 8px;
      font-weight: 500;
      transform: translateY(100px);
      transition: transform 0.3s;
    }
    
    .copy-notification.show {
      transform: translateY(0);
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Promptliano Brand Colors</h1>
    <p class="subtitle">Comprehensive color palette for all brand materials</p>
    
    <!-- Brand Colors -->
    <section class="section">
      <h2>Brand Colors</h2>
      <div class="color-grid">
        ${Object.entries(colorsData.brand)
          .map(
            ([key, color]) => `
        <div class="color-card">
          <div class="color-preview" style="background-color: ${color.hex}" onclick="copyToClipboard('${color.hex}')"></div>
          <div class="color-info">
            <div class="color-name">${color.name}</div>
            <div class="color-values">
              <div class="color-value" onclick="copyToClipboard('${color.hex}')">${color.hex}</div>
              <div class="color-value" onclick="copyToClipboard('${color.rgb}')">${color.rgb}</div>
              <div class="color-value" onclick="copyToClipboard('${color.hsl}')">${color.hsl}</div>
            </div>
            <div class="color-usage">${color.usage}</div>
          </div>
        </div>
        `
          )
          .join('')}
      </div>
    </section>
    
    <!-- Semantic Colors -->
    <section class="section">
      <h2>Semantic Colors</h2>
      <div class="color-grid">
        ${Object.entries(colorsData.semantic)
          .map(
            ([key, color]) => `
        <div class="color-card">
          <div class="color-preview" style="background-color: ${color.hex}" onclick="copyToClipboard('${color.hex}')"></div>
          <div class="color-info">
            <div class="color-name">${color.name}</div>
            <div class="color-values">
              <div class="color-value" onclick="copyToClipboard('${color.hex}')">${color.hex}</div>
              <div class="color-value" onclick="copyToClipboard('${color.rgb}')">${color.rgb}</div>
              <div class="color-value" onclick="copyToClipboard('${color.hsl}')">${color.hsl}</div>
            </div>
            <div class="color-usage">${color.usage}</div>
          </div>
        </div>
        `
          )
          .join('')}
      </div>
    </section>
    
    <!-- Extended Palette -->
    <section class="section">
      <h2>Extended Palette</h2>
      <div class="color-grid">
        ${Object.entries(colorsData.extended)
          .map(
            ([key, color]) => `
        <div class="color-card">
          <div class="color-preview" style="background-color: ${color.hex}" onclick="copyToClipboard('${color.hex}')"></div>
          <div class="color-info">
            <div class="color-name">${color.name}</div>
            <div class="color-values">
              <div class="color-value" onclick="copyToClipboard('${color.hex}')">${color.hex}</div>
              <div class="color-value" onclick="copyToClipboard('${color.rgb}')">${color.rgb}</div>
              <div class="color-value" onclick="copyToClipboard('${color.hsl}')">${color.hsl}</div>
            </div>
            <div class="color-usage">${color.usage}</div>
          </div>
        </div>
        `
          )
          .join('')}
      </div>
    </section>
    
    <!-- Gradients -->
    <section class="section">
      <h2>Gradients</h2>
      ${Object.entries(colorsData.gradients)
        .filter(([_, g]: any) => g.from)
        .map(
          ([key, gradient]: any) => `
      <div class="gradient-card">
        <div class="gradient-preview" style="background: linear-gradient(${gradient.direction}, ${gradient.from}, ${gradient.to})"></div>
        <div class="gradient-info">
          <div class="gradient-name">${gradient.name}</div>
          <div class="gradient-usage">${gradient.usage}</div>
        </div>
      </div>
      `
        )
        .join('')}
    </section>
    
    <!-- Neutral Colors -->
    <section class="section">
      <h2>Neutral Colors</h2>
      <div class="color-grid">
        ${Object.entries(colorsData.neutrals)
          .map(
            ([key, color]) => `
        <div class="color-card">
          <div class="color-preview" style="background-color: ${color.hex}" onclick="copyToClipboard('${color.hex}')"></div>
          <div class="color-info">
            <div class="color-name">${key}</div>
            <div class="color-values">
              <div class="color-value" onclick="copyToClipboard('${color.hex}')">${color.hex}</div>
              <div class="color-value" onclick="copyToClipboard('${color.rgb}')">${color.rgb}</div>
              <div class="color-value" onclick="copyToClipboard('${color.hsl}')">${color.hsl}</div>
            </div>
          </div>
        </div>
        `
          )
          .join('')}
      </div>
    </section>
  </div>
  
  <div class="copy-notification" id="copyNotification">Copied to clipboard!</div>
  
  <script>
    function copyToClipboard(text) {
      navigator.clipboard.writeText(text).then(() => {
        const notification = document.getElementById('copyNotification');
        notification.classList.add('show');
        setTimeout(() => {
          notification.classList.remove('show');
        }, 2000);
      });
    }
  </script>
</body>
</html>`

  fs.writeFileSync(path.join(EXPORTS_DIR, 'color-preview.html'), html)
  console.log('✅ Generated HTML preview file')
}

generateHTMLPreview()
