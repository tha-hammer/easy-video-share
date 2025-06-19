# Frontend Setup Guide

## Prerequisites
- Node.js (v16 or higher)
- AWS credentials from your deployed infrastructure  
- Deployed Terraform infrastructure (including DynamoDB and API Gateway)

## 1. Get Your AWS Credentials

From your Terraform deployment, get the following values:

```bash
cd ../terraform
terraform output bucket_name
terraform output app_user_access_key_id
terraform output app_user_secret_access_key
terraform output api_videos_endpoint
```

## 2. Configure AWS Credentials

### Option A: Automated Setup (Recommended)

Run the setup script from the project root:

```bash
# From the project root directory
chmod +x scripts/setup-frontend.sh
./scripts/setup-frontend.sh
```

This script will automatically:
- Get credentials from your Terraform deployment
- Create the `.env` file with correct values
- Show you a summary of the configuration

### Option B: Manual Setup

Create a `.env` file in the frontend directory with your AWS credentials:

```bash
# .env file (create this in the frontend/ directory)
VITE_AWS_REGION=us-east-1
VITE_AWS_BUCKET_NAME=easy-video-share-silmari-dev
VITE_AWS_ACCESS_KEY_ID=your-actual-access-key
VITE_AWS_SECRET_ACCESS_KEY=your-actual-secret-key
```

Get your actual values with:
```bash
cd terraform
terraform output bucket_name
terraform output app_user_access_key_id
terraform output app_user_secret_access_key
```

**Important Notes:**
- Variables must be prefixed with `VITE_` to be accessible in Vite.js
- Never commit the `.env` file to git (it's already in .gitignore)
- The config.js file will automatically load these environment variables

## 3. Install Dependencies

```bash
npm install
```

## 4. Run Development Server

```bash
npm run dev
```

The application will be available at `http://localhost:5173`

## 5. Test Upload Functionality

1. Open the application in your browser
2. **Enter a username** (new field - required for tracking)
3. Enter a video title
4. Select a video file (max 2GB, formats: MP4, MOV, AVI, WebM)
5. Click "Upload Video"
6. Wait for upload completion
7. Video metadata is saved to DynamoDB via API
8. Video should appear in the list below with username
9. Click "Play" to test video playback

### New Features in This Version

- **User Tracking**: Each upload now requires a username
- **Database Storage**: Video metadata is stored in DynamoDB for better querying
- **API Integration**: RESTful API handles video metadata operations
- **Enhanced Display**: Video list now shows who uploaded each video

## 6. Deploy to S3

### Option A: Automated Deployment (Recommended)

Use the deployment script from the project root:

```bash
# From the project root directory
chmod +x scripts/deploy-frontend.sh
./scripts/deploy-frontend.sh
```

This script will automatically:
- Build the production version of your app
- Get the bucket name from Terraform
- Upload all files to S3 with proper content types
- Set cache headers for optimal performance
- Provide you with the live website URL

### Option B: Manual Deployment

```bash
# Build the application
npm run build

# Get bucket name from Terraform
cd ../terraform
BUCKET_NAME=$(terraform output -raw bucket_name)
cd ../frontend

# Upload to S3
aws s3 cp dist/ s3://$BUCKET_NAME/ --recursive --exclude "*.map"

# Set proper content types
aws s3 cp dist/index.html s3://$BUCKET_NAME/index.html --content-type "text/html"
aws s3 cp dist/assets/ s3://$BUCKET_NAME/assets/ --recursive --content-type-by-suffix
```

### Accessing Your Deployed App

After deployment, your app will be available at your S3 website endpoint:

```bash
# Get your website URL
cd terraform
terraform output bucket_website_endpoint
```

The URL will be something like: `http://your-bucket-name.s3-website-us-east-1.amazonaws.com`

## Troubleshooting

### CORS Errors
- Ensure your Terraform infrastructure deployed the CORS configuration
- Check browser console for specific CORS error messages
- Verify bucket policy allows public access to videos/* and metadata/*

### Upload Failures
- Check AWS credentials are correct in config.js
- Verify file size is under 100MB
- Ensure file type is supported (MP4, MOV, AVI, WebM)
- Check browser console for detailed error messages

### Videos Not Loading
- Verify metadata files are being created in S3
- Check browser network tab for failed requests
- Ensure bucket policy allows public read access

## Security Note

⚠️ **Important**: This configuration puts AWS credentials directly in the frontend code. In production, you should:

1. Use a backend service to handle AWS operations
2. Implement temporary credentials (STS)
3. Use environment variables for configuration
4. Add user authentication and authorization

This current setup is for development/learning purposes only.

## File Structure

```
frontend/
├── src/
│   ├── main.js          # Main application logic
│   ├── style.css        # Application styling
│   ├── config.js        # AWS configuration
│   └── ...
├── index.html           # Main HTML file
├── package.json         # Dependencies
└── SETUP.md            # This file
``` 