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
  allowedExtensions: ['.mp4', '.mov', '.avi', '.webm']
} 