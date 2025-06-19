#!/bin/bash

# Deploy Frontend to S3
# This script builds the Vite app and deploys it to your S3 bucket

set -e

echo "🚀 Deploying Frontend to S3"
echo "============================"

# Check if we're in the right directory
if [ ! -d "terraform" ] || [ ! -d "frontend" ]; then
    echo "❌ Error: Run this script from the project root directory"
    echo "Expected directories: terraform/ and frontend/"
    exit 1
fi

# Check if Terraform state exists
if [ ! -f "terraform/terraform.tfstate" ]; then
    echo "❌ Error: Terraform state not found. Deploy infrastructure first:"
    echo "cd terraform && terraform apply"
    exit 1
fi

# Get bucket name from Terraform
echo "📋 Getting bucket information from Terraform..."
cd terraform
BUCKET_NAME=$(terraform output -raw bucket_name 2>/dev/null)
WEBSITE_ENDPOINT=$(terraform output -raw bucket_website_endpoint 2>/dev/null)
cd ..

if [ -z "$BUCKET_NAME" ]; then
    echo "❌ Error: Could not get bucket name from Terraform"
    exit 1
fi

echo "📦 Target bucket: $BUCKET_NAME"
echo "🌐 Website will be available at: http://$WEBSITE_ENDPOINT"

# Check if frontend dependencies are installed
if [ ! -d "frontend/node_modules" ]; then
    echo "📥 Installing frontend dependencies..."
    cd frontend
    npm install
    cd ..
fi

# Build the frontend
echo "🔨 Building frontend application..."
cd frontend
npm run build
cd ..

# Check if build was successful
if [ ! -d "frontend/dist" ]; then
    echo "❌ Error: Build failed - dist directory not found"
    exit 1
fi

echo "📤 Deploying to S3..."

# Upload all files
aws s3 cp frontend/dist/ s3://$BUCKET_NAME/ --recursive --exclude "*.map"

# Set specific content types for better performance
echo "🔧 Setting content types..."

# HTML files
aws s3 cp frontend/dist/index.html s3://$BUCKET_NAME/index.html \
    --content-type "text/html" \
    --cache-control "public, max-age=300"

# CSS files
aws s3 cp frontend/dist/assets/ s3://$BUCKET_NAME/assets/ \
    --recursive \
    --exclude "*" \
    --include "*.css" \
    --content-type "text/css" \
    --cache-control "public, max-age=31536000"

# JavaScript files
aws s3 cp frontend/dist/assets/ s3://$BUCKET_NAME/assets/ \
    --recursive \
    --exclude "*" \
    --include "*.js" \
    --content-type "application/javascript" \
    --cache-control "public, max-age=31536000"

# SVG files
if find frontend/dist -name "*.svg" -type f | grep -q .; then
    aws s3 cp frontend/dist/ s3://$BUCKET_NAME/ \
        --recursive \
        --exclude "*" \
        --include "*.svg" \
        --content-type "image/svg+xml" \
        --cache-control "public, max-age=31536000"
fi

# PNG/ICO files
if find frontend/dist -name "*.png" -o -name "*.ico" -type f | grep -q .; then
    aws s3 cp frontend/dist/ s3://$BUCKET_NAME/ \
        --recursive \
        --exclude "*" \
        --include "*.png" \
        --include "*.ico" \
        --cache-control "public, max-age=31536000"
fi

echo "✅ Deployment complete!"
echo ""
echo "🌐 Your application is now live at:"
echo "   http://$WEBSITE_ENDPOINT"
echo ""
echo "📋 Deployment Summary:"
echo "====================="
echo "Bucket:    $BUCKET_NAME"
echo "Endpoint:  http://$WEBSITE_ENDPOINT"
echo "Build:     frontend/dist/"
echo ""
echo "💡 Tips:"
echo "- Test your application by visiting the URL above"
echo "- It may take a few minutes for changes to propagate"
echo "- Check browser developer tools if you encounter issues"
echo ""
echo "🎉 Happy video sharing!" 