#!/bin/bash

# Easy Video Share - Deploy and Test Script
# This script deploys the infrastructure and runs basic tests

set -e  # Exit on any error

echo "🚀 Easy Video Share - Infrastructure Deployment & Testing"
echo "========================================================="

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check prerequisites
echo "🔍 Checking prerequisites..."

if ! command -v terraform &> /dev/null; then
    print_error "Terraform is not installed or not in PATH"
    exit 1
fi

if ! command -v aws &> /dev/null; then
    print_error "AWS CLI is not installed or not in PATH"
    exit 1
fi

# Check AWS credentials
if ! aws sts get-caller-identity &> /dev/null; then
    print_error "AWS credentials not configured. Run 'aws configure' first."
    exit 1
fi

print_status "Prerequisites check passed"

# Check if terraform.tfvars exists
if [ ! -f "terraform/terraform.tfvars" ]; then
    print_warning "terraform.tfvars not found. Creating from example..."
    cp terraform/terraform.tfvars.example terraform/terraform.tfvars
    echo ""
    print_warning "IMPORTANT: Edit terraform/terraform.tfvars with your unique bucket name before continuing!"
    echo "Example: bucket_name = \"easy-video-share-yourname-dev\""
    echo ""
    read -p "Press Enter when you've updated terraform.tfvars..."
fi

# Navigate to terraform directory
cd terraform

echo ""
echo "🏗️  Deploying infrastructure..."

# Initialize terraform
echo "Initializing Terraform..."
terraform init

# Plan deployment
echo "Creating deployment plan..."
terraform plan -out=tfplan

# Ask for confirmation
echo ""
read -p "Deploy the infrastructure? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Deployment cancelled."
    exit 1
fi

# Apply deployment
echo "Deploying infrastructure..."
terraform apply tfplan

# Get outputs
echo ""
echo "📋 Infrastructure Details:"
echo "========================="
BUCKET_NAME=$(terraform output -raw bucket_name)
WEBSITE_ENDPOINT=$(terraform output -raw bucket_website_endpoint)
ACCESS_KEY_ID=$(terraform output -raw app_user_access_key_id)

echo "Bucket Name: $BUCKET_NAME"
echo "Website Endpoint: http://$WEBSITE_ENDPOINT"
echo "Access Key ID: $ACCESS_KEY_ID"

# Save credentials to a secure file
echo "💾 Saving credentials..."
cat > ../aws-credentials.txt << EOF
# AWS Credentials for Easy Video Share
# KEEP THIS FILE SECURE - DO NOT COMMIT TO GIT

BUCKET_NAME=$BUCKET_NAME
WEBSITE_ENDPOINT=$WEBSITE_ENDPOINT
ACCESS_KEY_ID=$ACCESS_KEY_ID
SECRET_ACCESS_KEY=$(terraform output -raw app_user_secret_access_key)
AWS_REGION=$(terraform output -raw aws_region)
EOF

print_status "Credentials saved to aws-credentials.txt"

# Run basic tests
echo ""
echo "🧪 Running basic infrastructure tests..."

# Test 1: Bucket existence
if aws s3 ls "s3://$BUCKET_NAME" &> /dev/null; then
    print_status "Bucket accessibility test passed"
else
    print_error "Cannot access bucket"
    exit 1
fi

# Test 2: Create folder structure
aws s3api put-object --bucket "$BUCKET_NAME" --key videos/ --content-length 0
aws s3api put-object --bucket "$BUCKET_NAME" --key metadata/ --content-length 0
print_status "Folder structure created"

# Test 3: Upload test files
echo "Test video content" > test-video.mp4
echo '{"title":"Test Video","filename":"test-video.mp4","uploadDate":"'$(date -I)'"}' > test-metadata.json

aws s3 cp test-video.mp4 "s3://$BUCKET_NAME/videos/"
aws s3 cp test-metadata.json "s3://$BUCKET_NAME/metadata/"
print_status "Test files uploaded"

# Test 4: Public access
sleep 5  # Wait for propagation
if curl -f -s "https://$BUCKET_NAME.s3.amazonaws.com/videos/test-video.mp4" > /dev/null; then
    print_status "Public access test passed"
else
    print_warning "Public access test failed (may need time to propagate)"
fi

# Test 5: Create basic index.html
cat > index.html << 'EOF'
<!DOCTYPE html>
<html>
<head>
    <title>Easy Video Share</title>
    <style>
        body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
        .success { color: green; }
    </style>
</head>
<body>
    <h1>🎥 Easy Video Share</h1>
    <p class="success">Infrastructure deployed successfully!</p>
    <p>Ready for video uploads and sharing.</p>
</body>
</html>
EOF

aws s3 cp index.html "s3://$BUCKET_NAME/"
print_status "Test website deployed"

# Clean up test files
rm test-video.mp4 test-metadata.json index.html

# Final output
echo ""
echo "🎉 Deployment Complete!"
echo "======================"
echo "Website URL: http://$WEBSITE_ENDPOINT"
echo "Bucket: $BUCKET_NAME"
echo ""
echo "Next steps:"
echo "1. Visit your website URL to see the test page"
echo "2. Check aws-credentials.txt for your access keys"
echo "3. Run 'terraform/TESTING.md' tests for comprehensive validation"
echo "4. Start building your Vite.js frontend!"
echo ""
print_warning "Remember: aws-credentials.txt contains sensitive information - keep it secure!"

# Go back to root directory
cd ..

echo ""
echo "✨ Ready to build something awesome!" 