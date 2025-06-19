# Configure the AWS Provider
terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

# S3 bucket for video storage
resource "aws_s3_bucket" "video_bucket" {
  bucket = var.bucket_name

  tags = {
    Name        = "Video Sharing Bucket"
    Environment = var.environment
    Project     = "easy-video-share"
  }
}

# Configure bucket versioning
resource "aws_s3_bucket_versioning" "video_bucket_versioning" {
  bucket = aws_s3_bucket.video_bucket.id
  versioning_configuration {
    status = "Enabled"
  }
}

# Configure bucket public access block
resource "aws_s3_bucket_public_access_block" "video_bucket_pab" {
  bucket = aws_s3_bucket.video_bucket.id

  block_public_acls       = false
  block_public_policy     = false
  ignore_public_acls      = false
  restrict_public_buckets = false
}

# Bucket policy for public read access to videos
resource "aws_s3_bucket_policy" "video_bucket_policy" {
  bucket = aws_s3_bucket.video_bucket.id

  depends_on = [aws_s3_bucket_public_access_block.video_bucket_pab]

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "PublicReadGetObject"
        Effect    = "Allow"
        Principal = "*"
        Action    = "s3:GetObject"
        Resource  = "${aws_s3_bucket.video_bucket.arn}/videos/*"
      },
      {
        Sid       = "PublicReadGetObjectMetadata"
        Effect    = "Allow"
        Principal = "*"
        Action    = "s3:GetObject"
        Resource  = "${aws_s3_bucket.video_bucket.arn}/metadata/*"
      },
      {
        Sid       = "PublicReadWebsiteFiles"
        Effect    = "Allow"
        Principal = "*"
        Action    = "s3:GetObject"
        Resource  = [
          "${aws_s3_bucket.video_bucket.arn}/index.html",
          "${aws_s3_bucket.video_bucket.arn}/error.html",
          "${aws_s3_bucket.video_bucket.arn}/assets/*"
        ]
      }
    ]
  })
}

# Configure static website hosting
resource "aws_s3_bucket_website_configuration" "video_bucket_website" {
  bucket = aws_s3_bucket.video_bucket.id

  index_document {
    suffix = "index.html"
  }

  error_document {
    key = "error.html"
  }
}

# Configure CORS for browser uploads
resource "aws_s3_bucket_cors_configuration" "video_bucket_cors" {
  bucket = aws_s3_bucket.video_bucket.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "POST", "PUT", "DELETE", "HEAD"]
    allowed_origins = ["*"]  # In production, specify your domain
    expose_headers  = ["ETag"]
    max_age_seconds = 3000
  }
}

# Server-side encryption configuration
resource "aws_s3_bucket_server_side_encryption_configuration" "video_bucket_encryption" {
  bucket = aws_s3_bucket.video_bucket.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}
/* 
# Lifecycle configuration to manage storage costs
resource "aws_s3_bucket_lifecycle_configuration" "video_bucket_lifecycle" {
  bucket = aws_s3_bucket.video_bucket.id

  rule {
    id     = "video_lifecycle"
    status = "Enabled"

    # Move videos to cheaper storage after 30 days
    transition {
      days          = 30
      storage_class = "STANDARD_IA"
    }

    # Archive videos after 90 days
    transition {
      days          = 90
      storage_class = "GLACIER"
    }
  }
} */

# IAM user for application access
resource "aws_iam_user" "video_app_user" {
  name = "${var.project_name}-app-user"

  tags = {
    Environment = var.environment
    Project     = var.project_name
  }
}

# IAM policy for application user
resource "aws_iam_user_policy" "video_app_user_policy" {
  name = "${var.project_name}-app-policy"
  user = aws_iam_user.video_app_user.name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:PutObjectAcl",
          "s3:GetObject",
          "s3:ListBucket"
        ]
        Resource = [
          aws_s3_bucket.video_bucket.arn,
          "${aws_s3_bucket.video_bucket.arn}/*"
        ]
      }
    ]
  })
}

# Access keys for the application user
resource "aws_iam_access_key" "video_app_user_key" {
  user = aws_iam_user.video_app_user.name
} 