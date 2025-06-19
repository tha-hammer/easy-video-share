# Video Sharing Infrastructure

This Terraform configuration creates the AWS infrastructure for the Easy Video Share platform.

## What This Creates

- **S3 Bucket**: For storing video files and metadata
- **Bucket Policy**: Public read access to videos and metadata
- **Static Website Hosting**: Serves the frontend application
- **CORS Configuration**: Allows browser uploads from your domain
- **IAM User**: For application access to S3
- **Lifecycle Rules**: Automatic cost optimization (moves old videos to cheaper storage)
- **Encryption**: Server-side encryption for all objects

## Prerequisites

1. **AWS Account**: With billing set up
2. **AWS CLI**: Installed and configured
3. **Terraform**: Version 1.0 or higher

## Quick Start

### 1. Configure AWS CLI
```bash
aws configure
# Enter your Access Key ID, Secret Access Key, and region
aws configure sso
# Enter Access key, secret key, SSO URL and region
```

### 2. Set Up Terraform Variables
```bash
# Copy the example file
cp terraform.tfvars.example terraform.tfvars

# Edit with your values (IMPORTANT: Make bucket name unique!)
# bucket_name = "easy-video-share-yourname-dev"
```

### 3. Deploy Infrastructure
```bash
# Initialize Terraform
terraform init

# Review the plan
terraform plan

# Apply the changes
terraform apply
```

### 4. Save Important Outputs
After deployment, Terraform will output important values:
- `bucket_name`: Your S3 bucket name
- `bucket_website_endpoint`: URL for static website hosting
- `app_user_access_key_id`: For your frontend application
- `app_user_secret_access_key`: Keep this secure!

## Important Security Notes

- **terraform.tfvars**: Contains your configuration - never commit to git
- **tfstate files**: Contain sensitive data - keep secure
- **Access keys**: Will be displayed after deployment - save them securely

## Bucket Structure

The bucket will organize files like this:
```
your-bucket-name/
├── videos/           # Video files (publicly readable)
├── metadata/         # Video metadata JSON files (publicly readable)
├── index.html        # Frontend application
└── assets/           # Frontend assets (CSS, JS)
```

## Cost Optimization Features

- **Lifecycle Rules**: Automatically moves videos to cheaper storage after 30 days
- **Intelligent Tiering**: Could be added later for automatic cost optimization
- **Free Tier**: Most usage will fall under AWS free tier limits

## Next Steps

1. Test bucket access: Upload a test file via AWS Console
2. Verify CORS configuration with a simple HTML upload test
3. Build the Vite.js frontend application
4. Deploy frontend to the S3 bucket

## Cleanup

To destroy all infrastructure:
```bash
terraform destroy
```

**Warning**: This will delete your bucket and all videos! 