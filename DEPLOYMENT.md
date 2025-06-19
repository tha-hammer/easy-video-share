# Easy Video Share - Deployment Guide

Complete deployment workflow for the video sharing platform.

## 🎯 Overview

This guide covers deploying the complete application:
1. **Infrastructure** (AWS S3, IAM, bucket policies)
2. **Frontend** (Vite.js app to S3 static hosting)

## 📋 Prerequisites

- AWS CLI configured
- Terraform installed
- Node.js (v16+)
- Git

## 🚀 Complete Deployment Workflow

### Step 1: Deploy Infrastructure

```bash
# Navigate to terraform directory
cd terraform

# Copy and configure variables
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with your unique bucket name

# Initialize and deploy
terraform init
terraform plan
terraform apply
```

### Step 2: Setup Frontend Environment

```bash
# From project root - automated setup
chmod +x scripts/setup-frontend.sh
./scripts/setup-frontend.sh
```

### Step 3: Test Locally (Optional)

```bash
cd frontend
npm run dev
# Test at http://localhost:5173
```

### Step 4: Deploy Frontend to S3

```bash
# From project root - automated deployment
chmod +x scripts/deploy-frontend.sh
./scripts/deploy-frontend.sh
```

## 🌐 Your Live Application

After deployment, your video sharing platform will be available at:
```
http://[bucket-name].s3-website-[region].amazonaws.com
```

Get the exact URL with:
```bash
cd terraform
terraform output bucket_website_endpoint
```

## 📁 What Gets Deployed

### Infrastructure (Terraform)
- ✅ S3 bucket with public read access for videos
- ✅ Bucket policy for secure public access
- ✅ Static website hosting configuration
- ✅ CORS configuration for browser uploads
- ✅ IAM user with minimal required permissions
- ✅ Lifecycle rules for cost optimization

### Frontend (Vite.js)
- ✅ Modern, responsive web application
- ✅ Video upload form with validation
- ✅ Direct browser-to-S3 uploads
- ✅ Video listing and playback
- ✅ Modal video player
- ✅ Mobile-friendly design

## 🛠️ Useful Commands

### Check Infrastructure Status
```bash
cd terraform
terraform show
terraform output
```

### Redeploy Frontend Only
```bash
./scripts/deploy-frontend.sh
```

### View Live Logs (Development)
```bash
cd frontend
npm run dev
```

### Build for Production
```bash
cd frontend
npm run build
```

## 🔧 Configuration Files

| File | Purpose |
|------|---------|
| `terraform/terraform.tfvars` | Infrastructure configuration |
| `frontend/.env` | AWS credentials for frontend |
| `terraform/main.tf` | Infrastructure definition |
| `frontend/src/config.js` | Frontend AWS configuration |

## 💰 Cost Estimation

With moderate usage (under AWS free tier):
- **S3 Storage**: ~$1-5/month
- **S3 Requests**: ~$1-3/month
- **Data Transfer**: Usually free tier
- **Total**: ~$2-8/month

## 🔒 Security Notes

Current setup is designed for **learning/development**:

### ✅ Good Security Practices
- Bucket policy restricts public access to specific folders
- IAM user has minimal required permissions
- HTTPS for all API calls
- No root AWS credentials used

### ⚠️ Production Considerations
- Frontend contains AWS credentials (visible to users)
- No user authentication system
- No rate limiting
- No content moderation

### 🚀 Production Improvements
1. **Backend API** for AWS operations
2. **User authentication** (Cognito, Auth0)
3. **Temporary credentials** (AWS STS)
4. **CDN** (CloudFront) for better performance
5. **Monitoring** and alerting
6. **Content scanning** for security

## 🧹 Cleanup

To destroy all resources:
```bash
cd terraform
terraform destroy
```

⚠️ **Warning**: This will delete your bucket and all uploaded videos!

## 🎉 Success Criteria

Your deployment is successful when:
- ✅ Website loads at the S3 endpoint
- ✅ You can upload a video file
- ✅ Uploaded video appears in the list
- ✅ Video plays in the modal player
- ✅ Responsive design works on mobile

## 📞 Troubleshooting

### Infrastructure Issues
- Check Terraform outputs: `terraform output`
- Verify AWS credentials: `aws sts get-caller-identity`
- Check bucket policy in AWS Console

### Frontend Issues
- Check browser console for errors
- Verify .env file has correct credentials
- Test CORS with browser developer tools

### Upload Issues
- Verify file size under 100MB
- Check supported formats (MP4, MOV, AVI, WebM)
- Confirm IAM user permissions in AWS Console

---

🎊 **Congratulations!** You've deployed a complete cloud-native video sharing platform! 