#!/usr/bin/env node
import sharp from 'sharp'
import { readdir, stat, mkdir } from 'fs/promises'
import { join, dirname, basename, extname } from 'path'
import { existsSync } from 'fs'

const SUPPORTED_FORMATS = ['.jpg', '.jpeg', '.png', '.webp']
const OUTPUT_FORMATS = ['webp', 'avif'] as const
const SIZES = [640, 768, 1024, 1280, 1920]
const QUALITY = { webp: 80, avif: 70 }

interface ImageOptimizationOptions {
  inputDir: string
  outputDir: string
  generateSrcset?: boolean
  formats?: (typeof OUTPUT_FORMATS)[number][]
  sizes?: number[]
}

async function ensureDir(path: string) {
  if (!existsSync(path)) {
    await mkdir(path, { recursive: true })
  }
}

async function processImage(inputPath: string, outputDir: string, options: ImageOptimizationOptions) {
  const ext = extname(inputPath).toLowerCase()
  if (!SUPPORTED_FORMATS.includes(ext)) return

  const filename = basename(inputPath, ext)
  const formats = options.formats || OUTPUT_FORMATS
  const sizes = options.generateSrcset ? options.sizes || SIZES : [0]

  const image = sharp(inputPath)
  const metadata = await image.metadata()
  const originalWidth = metadata.width || 0

  for (const format of formats) {
    for (const width of sizes) {
      const isOriginalSize = width === 0
      const targetWidth = isOriginalSize ? originalWidth : Math.min(width, originalWidth)

      const sizeSuffix = isOriginalSize ? '' : `-${targetWidth}w`
      const outputPath = join(outputDir, `${filename}${sizeSuffix}.${format}`)

      await ensureDir(dirname(outputPath))

      const pipeline = image.clone()

      if (!isOriginalSize && targetWidth < originalWidth) {
        pipeline.resize(targetWidth, null, {
          withoutEnlargement: true,
          fit: 'inside'
        })
      }

      await pipeline[format]({ quality: QUALITY[format] }).toFile(outputPath)

      console.log(`✓ Generated: ${outputPath}`)
    }
  }

  // Generate placeholder
  const placeholderPath = join(outputDir, `${filename}-placeholder.svg`)
  const placeholderBuffer = await image.clone().resize(20).blur(10).toBuffer()

  const placeholderBase64 = placeholderBuffer.toString('base64')
  const placeholderSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${originalWidth} ${metadata.height}">
    <filter id="blur">
      <feGaussianBlur stdDeviation="20" />
    </filter>
    <image 
      filter="url(#blur)" 
      width="100%" 
      height="100%" 
      href="data:image/jpeg;base64,${placeholderBase64}"
    />
  </svg>`

  await sharp(Buffer.from(placeholderSvg)).toFile(placeholderPath)

  console.log(`✓ Generated placeholder: ${placeholderPath}`)
}

async function findImages(dir: string, images: string[] = []): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true })

  for (const entry of entries) {
    const fullPath = join(dir, entry.name)

    if (entry.isDirectory()) {
      await findImages(fullPath, images)
    } else if (entry.isFile()) {
      const ext = extname(entry.name).toLowerCase()
      if (SUPPORTED_FORMATS.includes(ext)) {
        images.push(fullPath)
      }
    }
  }

  return images
}

export async function optimizeImages(options: ImageOptimizationOptions) {
  const images = await findImages(options.inputDir)

  console.log(`Found ${images.length} images to optimize`)

  for (const imagePath of images) {
    const relativePath = imagePath.replace(options.inputDir, '')
    const outputSubDir = dirname(relativePath)
    const outputDir = join(options.outputDir, outputSubDir)

    await processImage(imagePath, outputDir, options)
  }

  console.log('✨ Image optimization complete!')
}

// CLI interface
if (require.main === module) {
  const [inputDir = './public/images', outputDir = './public/optimized'] = process.argv.slice(2)

  optimizeImages({
    inputDir,
    outputDir,
    generateSrcset: true,
    formats: ['webp', 'avif']
  }).catch(console.error)
}
