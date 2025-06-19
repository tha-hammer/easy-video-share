// AWS Configuration for Easy Video Share
// Loads from environment variables (.env file) or falls back to hardcoded values
// In Vite, environment variables must be prefixed with VITE_ to be accessible

export const AWS_CONFIG = {
  region: import.meta.env.VITE_AWS_REGION || 'us-east-1',
  bucketName: import.meta.env.VITE_AWS_BUCKET_NAME || 'easy-video-share-silmari-dev',
  credentials: {
    accessKeyId: import.meta.env.VITE_AWS_ACCESS_KEY_ID || 'YOUR_ACCESS_KEY_ID',
    secretAccessKey: import.meta.env.VITE_AWS_SECRET_ACCESS_KEY || 'YOUR_SECRET_ACCESS_KEY'
  }
}

// File upload constraints
export const UPLOAD_CONFIG = {
  maxFileSize: 2 * 1024 * 1024 * 1024, // 2GB in bytes
  allowedTypes: ['video/mp4', 'video/mov', 'video/avi', 'video/webm', 'video/quicktime'],
  allowedExtensions: ['.mp4', '.mov', '.avi', '.webm'],
  
  // Multipart upload settings optimized for high bandwidth
  multipartThreshold: 200 * 1024 * 1024, // Use multipart for files > 200MB (higher threshold)
  chunkSize: 50 * 1024 * 1024, // 50MB chunks (much larger for better throughput)
  maxConcurrentUploads: 6, // More parallel uploads for high bandwidth
  useTransferAcceleration: false // Disabled due to DNS resolution issues
} 