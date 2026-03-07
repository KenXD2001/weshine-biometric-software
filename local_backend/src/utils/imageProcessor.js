const sharp = require('sharp');
const fs = require('fs');
const logger = require('../config/logger');

class ImageProcessor {
  /**
   * Process and optimize captured image
   * @param {string} base64String - Base64 image data
   * @param {string} outputPath - Output file path
   * @param {Object} options - Processing options
   * @returns {Promise<Object>} - Processing results
   */
  static async processImage(base64String, outputPath, options = {}) {
    try {
      const {
        maxWidth = 1280,
        maxHeight = 720,
        quality = 85,
        format = 'jpeg',
        enhance = true
      } = options;

      // Remove data URI prefix
      const base64Data = base64String.replace(/^data:image\/\w+;base64,/, '');
      const imageBuffer = Buffer.from(base64Data, 'base64');

      // Get image metadata
      const metadata = await sharp(imageBuffer).metadata();
      const { width, height, size } = metadata;

      logger.info('Processing image', {
        originalSize: `${width}x${height}`,
        fileSizeKB: Math.round(size / 1024),
        format: metadata.format
      });

      // Validate minimum quality requirements
      if (width < 640 || height < 480) {
        throw new Error(`Image resolution too low: ${width}x${height}. Minimum: 640x480`);
      }

      if (size < 30000) { // Less than 30KB suggests poor quality
        throw new Error(`Image file size too small: ${Math.round(size/1024)}KB. Minimum: 30KB`);
      }

      let processedImage = sharp(imageBuffer);

      // Enhance image quality
      if (enhance) {
        processedImage = processedImage
          .resize(maxWidth, maxHeight, { 
            fit: 'inside',
            withoutEnlargement: true 
          })
          .sharpen({ 
            sigma: 1, 
            flat: 1.5, 
            jagged: 2 
          })
          .normalize()
          .gamma(1.1);
      }

      // Optimize for face recognition
      const finalBuffer = await processedImage
        .jpeg({ 
          quality,
          progressive: true,
          mozjpeg: true // Better compression
        })
        .toBuffer();

      // Save processed image
      fs.writeFileSync(outputPath, finalBuffer);

      const processedSize = finalBuffer.length;
      const compressionRatio = ((size - processedSize) / size * 100).toFixed(1);

      logger.success('Image processed successfully', {
        originalSize: `${Math.round(size/1024)}KB`,
        processedSize: `${Math.round(processedSize/1024)}KB`,
        compressionRatio: `${compressionRatio}%`,
        dimensions: `${maxWidth}x${maxHeight}`,
        quality: `${quality}%`
      });

      return {
        success: true,
        originalSize: size,
        processedSize,
        compressionRatio,
        dimensions: { width: maxWidth, height: maxHeight },
        outputPath
      };

    } catch (error) {
      logger.error('Image processing failed', {
        error: error.message,
        outputPath
      });
      throw error;
    }
  }

  /**
   * Validate image quality for biometric use
   * @param {string} base64String - Base64 image data
   * @returns {Promise<Object>} - Validation results
   */
  static async validateImageQuality(base64String) {
    try {
      const base64Data = base64String.replace(/^data:image\/\w+;base64,/, '');
      const imageBuffer = Buffer.from(base64Data, 'base64');
      
      const metadata = await sharp(imageBuffer).metadata();
      const { width, height, size } = metadata;

      // Quality checks
      const checks = {
        resolution: {
          passed: width >= 640 && height >= 480,
          actual: `${width}x${height}`,
          required: '640x480 minimum'
        },
        fileSize: {
          passed: size >= 30000, // 30KB minimum
          actual: `${Math.round(size/1024)}KB`,
          required: '30KB minimum'
        },
        aspectRatio: {
          passed: Math.abs((width/height) - (4/3)) < 0.2, // Allow 20% variance from 4:3
          actual: (width/height).toFixed(2),
          recommended: '4:3 for portraits'
        }
      };

      const overallPassed = Object.values(checks).every(check => check.passed);

      return {
        passed: overallPassed,
        checks,
        metadata: {
          width,
          height,
          sizeKB: Math.round(size/1024),
          format: metadata.format
        }
      };

    } catch (error) {
      return {
        passed: false,
        error: error.message,
        checks: {}
      };
    }
  }
}

module.exports = ImageProcessor;
