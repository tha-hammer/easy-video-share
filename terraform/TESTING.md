# Infrastructure Testing Guide

After deploying your Terraform infrastructure, follow these tests to ensure everything works correctly.

## Pre-Test Setup

First, capture the Terraform outputs for testing:

```bash
# Get all outputs
terraform output

# Save specific values for testing
export BUCKET_NAME=$(terraform output -raw bucket_name)
export WEBSITE_ENDPOINT=$(terraform output -raw bucket_website_endpoint)
export ACCESS_KEY_ID=$(terraform output -raw app_user_access_key_id)
export SECRET_ACCESS_KEY=$(terraform output -raw app_user_secret_access_key)

echo "Bucket: $BUCKET_NAME"
echo "Website: $WEBSITE_ENDPOINT"
echo "Access Key: $ACCESS_KEY_ID"
```

## Test 1: Basic AWS Connectivity

**Objective**: Verify AWS CLI can access your resources

```bash
# Test basic AWS connectivity
aws sts get-caller-identity

# List your S3 buckets (should include your new bucket)
aws s3 ls

# Get detailed info about your bucket
aws s3api get-bucket-location --bucket $BUCKET_NAME
aws s3api get-bucket-policy --bucket $BUCKET_NAME
```

**Expected Results**:
- Your bucket appears in the list
- Bucket location matches your region
- Bucket policy shows public read access for videos/* and metadata/*

## Test 2: S3 Bucket Structure & Permissions

**Objective**: Verify bucket configuration and folder structure

```bash
# Create test folder structure
aws s3api put-object --bucket $BUCKET_NAME --key videos/ --content-length 0
aws s3api put-object --bucket $BUCKET_NAME --key metadata/ --content-length 0

# Verify folder creation
aws s3 ls s3://$BUCKET_NAME/

# Test bucket website configuration
aws s3api get-bucket-website --bucket $BUCKET_NAME
```

**Expected Results**:
- Folders `videos/` and `metadata/` are created
- Website configuration shows index.html as default document

## Test 3: Upload Test Files

**Objective**: Test file upload functionality and permissions

```bash
# Create test files
echo "Test video content" > test-video.mp4
echo '{"title":"Test Video","filename":"test-video.mp4","uploadDate":"2024-01-01"}' > test-metadata.json

# Upload test files to appropriate folders
aws s3 cp test-video.mp4 s3://$BUCKET_NAME/videos/test-video.mp4
aws s3 cp test-metadata.json s3://$BUCKET_NAME/metadata/test-video.json

# Verify uploads
aws s3 ls s3://$BUCKET_NAME/videos/
aws s3 ls s3://$BUCKET_NAME/metadata/

# Clean up test files
rm test-video.mp4 test-metadata.json
```

**Expected Results**:
- Files upload successfully
- Files appear in correct folders

## Test 4: Public Access Verification

**Objective**: Verify public read access works correctly

```bash
# Test public access to video file
curl -I https://$BUCKET_NAME.s3.amazonaws.com/videos/test-video.mp4

# Test public access to metadata file
curl https://$BUCKET_NAME.s3.amazonaws.com/metadata/test-video.json

# Test that root folder is NOT publicly accessible (should get access denied)
curl -I https://$BUCKET_NAME.s3.amazonaws.com/
```

**Expected Results**:
- Video file returns 200 OK
- Metadata file returns JSON content
- Root folder returns 403 Forbidden (this is correct!)

## Test 5: CORS Configuration

**Objective**: Test CORS headers for browser upload compatibility

```bash
# Test CORS preflight request
curl -H "Origin: http://localhost:3000" \
     -H "Access-Control-Request-Method: PUT" \
     -H "Access-Control-Request-Headers: Content-Type" \
     -X OPTIONS \
     -I https://$BUCKET_NAME.s3.amazonaws.com/videos/
```

**Expected Results**:
- Response includes `Access-Control-Allow-Origin: *`
- Response includes `Access-Control-Allow-Methods` with PUT, POST, GET
- Response includes `Access-Control-Allow-Headers`

## Test 6: IAM User Permissions

**Objective**: Verify application user can upload files

```bash
# Configure AWS CLI with app user credentials (temporary profile)
aws configure set aws_access_key_id $ACCESS_KEY_ID --profile video-app
aws configure set aws_secret_access_key $SECRET_ACCESS_KEY --profile video-app
aws configure set region us-east-1 --profile video-app

# Test upload with app user credentials
echo "App user test" > app-test.txt
aws s3 cp app-test.txt s3://$BUCKET_NAME/videos/app-test.txt --profile video-app

# Test that app user cannot access other buckets (should fail)
aws s3 ls --profile video-app

# Clean up
aws s3 rm s3://$BUCKET_NAME/videos/app-test.txt --profile video-app
rm app-test.txt
```

**Expected Results**:
- App user can upload to your bucket
- App user cannot list all buckets (limited permissions working)

## Test 7: Static Website Hosting

**Objective**: Verify website hosting configuration

```bash
# Create a simple test index.html
cat > index.html << 'EOF'
<!DOCTYPE html>
<html>
<head>
    <title>Video Sharing Test</title>
</head>
<body>
    <h1>Easy Video Share</h1>
    <p>Infrastructure test successful!</p>
</body>
</html>
EOF

# Upload test page
aws s3 cp index.html s3://$BUCKET_NAME/

# Test website access
curl http://$WEBSITE_ENDPOINT

# Clean up
rm index.html
```

**Expected Results**:
- Website endpoint returns the HTML content
- No HTTPS errors (though it's HTTP for S3 static hosting)

## Test 8: Browser Upload Simulation

**Objective**: Create a simple HTML page to test browser uploads

```bash
# Create upload test page
cat > upload-test.html << 'EOF'
<!DOCTYPE html>
<html>
<head>
    <title>Upload Test</title>
    <script src="https://unpkg.com/@aws-sdk/client-s3@latest/dist-browser/index.js"></script>
</head>
<body>
    <h1>S3 Upload Test</h1>
    <input type="file" id="fileInput" accept="video/*">
    <button onclick="uploadFile()">Upload Test</button>
    <div id="status"></div>

    <script>
        // Replace with your actual values
        const BUCKET_NAME = 'YOUR_BUCKET_NAME';
        const ACCESS_KEY_ID = 'YOUR_ACCESS_KEY';
        const SECRET_ACCESS_KEY = 'YOUR_SECRET_KEY';
        
        async function uploadFile() {
            const fileInput = document.getElementById('fileInput');
            const statusDiv = document.getElementById('status');
            
            if (!fileInput.files[0]) {
                statusDiv.innerHTML = 'Please select a file';
                return;
            }
            
            statusDiv.innerHTML = 'Testing upload configuration...';
            
            // This is just a CORS test - don't put real credentials in production!
            const testUrl = `https://${BUCKET_NAME}.s3.amazonaws.com/videos/test-cors.txt`;
            
            try {
                const response = await fetch(testUrl, {
                    method: 'HEAD',
                    mode: 'cors'
                });
                statusDiv.innerHTML = 'CORS configuration working! ✅';
            } catch (error) {
                statusDiv.innerHTML = 'CORS test failed: ' + error.message;
            }
        }
    </script>
</body>
</html>
EOF

# Upload test page
aws s3 cp upload-test.html s3://$BUCKET_NAME/

echo "Test page available at: http://$WEBSITE_ENDPOINT/upload-test.html"
```

## Test Results Checklist

After running all tests, you should have:

- ✅ **Basic Connectivity**: AWS CLI can access your resources
- ✅ **Bucket Structure**: videos/ and metadata/ folders exist
- ✅ **Upload Functionality**: Files can be uploaded to S3
- ✅ **Public Access**: Videos and metadata are publicly readable
- ✅ **CORS Headers**: Proper headers for browser uploads
- ✅ **IAM Permissions**: App user has correct limited access
- ✅ **Website Hosting**: Static website endpoint works
- ✅ **Browser Compatibility**: CORS test passes in browser

## Troubleshooting Common Issues

### Issue: "Access Denied" when accessing public files
**Solution**: Check bucket policy deployment and public access block settings

### Issue: CORS errors in browser
**Solution**: Verify CORS configuration and wait a few minutes for propagation

### Issue: IAM user cannot upload
**Solution**: Check IAM policy and ensure user has correct permissions

### Issue: Website endpoint not working
**Solution**: Verify static website hosting is enabled and index.html exists

## Next Steps

Once all tests pass:
1. Note down your bucket name and access credentials
2. Proceed to build the Vite.js frontend
3. Integrate AWS SDK in your frontend application
4. Deploy frontend to the S3 bucket

## Cleanup Test Files

```bash
# Remove all test files
aws s3 rm s3://$BUCKET_NAME/videos/test-video.mp4
aws s3 rm s3://$BUCKET_NAME/metadata/test-video.json
aws s3 rm s3://$BUCKET_NAME/index.html
aws s3 rm s3://$BUCKET_NAME/upload-test.html
``` 