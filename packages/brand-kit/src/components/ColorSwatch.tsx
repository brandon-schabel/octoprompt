import React from 'react'

interface ColorSwatchProps {
  name: string
  hex: string
  rgb?: string
  hsl?: string
  usage?: string
}

export function ColorSwatch({ name, hex, rgb, hsl, usage }: ColorSwatchProps) {
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  return (
    <div className='color-swatch'>
      <div
        className='color-swatch__preview'
        style={{ backgroundColor: hex }}
        onClick={() => copyToClipboard(hex)}
        title='Click to copy hex value'
      />
      <div className='color-swatch__info'>
        <h4 className='color-swatch__name'>{name}</h4>
        <div className='color-swatch__values'>
          <button onClick={() => copyToClipboard(hex)} className='color-swatch__value'>
            {hex}
          </button>
          {rgb && (
            <button onClick={() => copyToClipboard(rgb)} className='color-swatch__value'>
              {rgb}
            </button>
          )}
          {hsl && (
            <button onClick={() => copyToClipboard(hsl)} className='color-swatch__value'>
              {hsl}
            </button>
          )}
        </div>
        {usage && <p className='color-swatch__usage'>{usage}</p>}
      </div>
    </div>
  )
}

interface ColorPaletteProps {
  title: string
  colors: Record<string, any>
}

export function ColorPalette({ title, colors }: ColorPaletteProps) {
  return (
    <div className='color-palette'>
      <h3 className='color-palette__title'>{title}</h3>
      <div className='color-palette__grid'>
        {Object.entries(colors).map(([key, color]) => (
          <ColorSwatch
            key={key}
            name={color.name || key}
            hex={color.hex}
            rgb={color.rgb}
            hsl={color.hsl}
            usage={color.usage}
          />
        ))}
      </div>
    </div>
  )
}

// Styles (can be moved to a separate CSS file)
export const colorSwatchStyles = `
.color-swatch {
  border: 1px solid #e5e5e5;
  border-radius: 8px;
  overflow: hidden;
  transition: transform 0.2s;
}

.color-swatch:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.color-swatch__preview {
  height: 120px;
  cursor: pointer;
  position: relative;
}

.color-swatch__preview:hover::after {
  content: 'Click to copy';
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  font-size: 14px;
}

.color-swatch__info {
  padding: 16px;
  background: white;
}

.color-swatch__name {
  margin: 0 0 8px 0;
  font-size: 16px;
  font-weight: 600;
}

.color-swatch__values {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 8px;
}

.color-swatch__value {
  padding: 4px 8px;
  background: #f5f5f5;
  border: none;
  border-radius: 4px;
  font-family: monospace;
  font-size: 12px;
  cursor: pointer;
  text-align: left;
  transition: background 0.2s;
}

.color-swatch__value:hover {
  background: #e5e5e5;
}

.color-swatch__usage {
  margin: 0;
  font-size: 12px;
  color: #666;
  line-height: 1.4;
}

.color-palette {
  margin-bottom: 48px;
}

.color-palette__title {
  margin: 0 0 24px 0;
  font-size: 24px;
  font-weight: 700;
}

.color-palette__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 24px;
}
`
