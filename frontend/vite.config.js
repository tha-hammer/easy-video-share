import { defineConfig } from 'vite'

export default defineConfig({
  // Optimize dependencies for AWS SDK
  optimizeDeps: {
    include: [
      '@aws-sdk/client-s3'
    ]
  },
  
  // Define global variables for AWS SDK compatibility
  define: {
    global: 'globalThis',
  },
  
  // Build configuration
  build: {
    target: 'es2020',
    rollupOptions: {
      output: {
        manualChunks: {
          // Separate AWS SDK into its own chunk for better caching
          'aws-sdk': ['@aws-sdk/client-s3']
        }
      }
    }
  },
  
  // Development server configuration
  server: {
    host: true,
    port: 5173,
    // Disable restrictive CORS headers that block S3 content
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
      'Cross-Origin-Embedder-Policy': 'unsafe-none'
    }
  },
  
  // Resolve configuration for better AWS SDK compatibility
  resolve: {
    alias: {
      // Ensure proper stream handling
      './runtimeConfig': './runtimeConfig.browser'
    }
  }
}) 