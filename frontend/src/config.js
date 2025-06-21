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

// Cognito Configuration
export const COGNITO_CONFIG = {
  region: import.meta.env.VITE_COGNITO_REGION || 'us-east-1',
  userPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID || 'us-east-1_8L0Sa4BCn',
  userPoolClientId: import.meta.env.VITE_COGNITO_CLIENT_ID || '3ip5hntvq00uef8cfboolpasel'
}

// API Configuration
export const API_CONFIG = {
  baseUrl: import.meta.env.VITE_API_ENDPOINT || 'https://ip60d4qmjf.execute-api.us-east-1.amazonaws.com/dev',
  videosEndpoint: import.meta.env.VITE_API_VIDEOS_ENDPOINT || 'https://ip60d4qmjf.execute-api.us-east-1.amazonaws.com/dev/videos',
  // Admin endpoints
  adminUsersEndpoint: import.meta.env.VITE_API_ADMIN_USERS_ENDPOINT || 'https://ip60d4qmjf.execute-api.us-east-1.amazonaws.com/dev/admin/users',
  adminVideosEndpoint: import.meta.env.VITE_API_ADMIN_VIDEOS_ENDPOINT || 'https://ip60d4qmjf.execute-api.us-east-1.amazonaws.com/dev/admin/videos'
}

// File upload constraints
export const UPLOAD_CONFIG = {
  maxFileSize: 2 * 1024 * 1024 * 1024, // 2GB in bytes
  allowedTypes: ['video/mp4', 'video/mov', 'video/avi', 'video/webm', 'video/quicktime'],
  allowedExtensions: ['.mp4', '.mov', '.avi', '.webm'],
  
  // Multipart upload settings optimized for high bandwidth
  multipartThreshold: 200 * 1024 * 1024, // Use multipart for files > 200MB (higher threshold)
  // Disable multipart uploads by making the threshold effectively unreachable
  // multipartThreshold: Number.MAX_SAFE_INTEGER, // Multipart upload disabled
  chunkSize: 50 * 1024 * 1024, // 50MB chunks (much larger for better throughput)
  maxConcurrentUploads: 6, // More parallel uploads for high bandwidth
  useTransferAcceleration: true // Disabled due to DNS resolution issues
} 