#!/bin/bash

# Setup Frontend Environment Variables
# This script gets AWS credentials from Terraform and creates the .env file

set -e

echo "🔧 Setting up Frontend Environment Variables"
echo "============================================"

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

# Get credentials from Terraform
echo "📋 Getting AWS credentials from Terraform..."

cd terraform

BUCKET_NAME=$(terraform output -raw bucket_name 2>/dev/null)
ACCESS_KEY_ID=$(terraform output -raw app_user_access_key_id 2>/dev/null)
SECRET_ACCESS_KEY=$(terraform output -raw app_user_secret_access_key 2>/dev/null)
AWS_REGION=$(terraform output -raw aws_region 2>/dev/null)

cd ..

# Validate outputs
if [ -z "$BUCKET_NAME" ] || [ -z "$ACCESS_KEY_ID" ] || [ -z "$SECRET_ACCESS_KEY" ]; then
    echo "❌ Error: Could not retrieve all required values from Terraform"
    echo "Make sure your infrastructure is deployed and terraform outputs are available"
    exit 1
fi

# Create .env file
echo "📝 Creating frontend/.env file..."

cat > frontend/.env << EOF
# AWS Configuration for Easy Video Share
# Generated automatically from Terraform outputs
# DO NOT commit this file to git

VITE_AWS_REGION=${AWS_REGION}
VITE_AWS_BUCKET_NAME=${BUCKET_NAME}
VITE_AWS_ACCESS_KEY_ID=${ACCESS_KEY_ID}
VITE_AWS_SECRET_ACCESS_KEY=${SECRET_ACCESS_KEY}
EOF

echo "✅ Frontend environment variables configured!"
echo ""
echo "📋 Configuration Summary:"
echo "========================"
echo "Region:      ${AWS_REGION}"
echo "Bucket:      ${BUCKET_NAME}"
echo "Access Key:  ${ACCESS_KEY_ID}"
echo ""
echo "🚀 Next steps:"
echo "1. cd frontend"
echo "2. npm install"
echo "3. npm run dev"
echo ""
echo "🔒 Security Note: Keep your .env file secure and never commit it to git!"

echo ""
echo "✨ Ready to start developing!" 