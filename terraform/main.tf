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

# Enable S3 Transfer Acceleration for faster uploads
resource "aws_s3_bucket_accelerate_configuration" "video_bucket_accelerate" {
  bucket = aws_s3_bucket.video_bucket.id
  status = "Enabled"
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

# DynamoDB table for video metadata
resource "aws_dynamodb_table" "video_metadata" {
  name           = "${var.project_name}-video-metadata"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "video_id"

  attribute {
    name = "video_id"
    type = "S"
  }

  attribute {
    name = "username"
    type = "S"
  }

  attribute {
    name = "upload_date"
    type = "S"
  }

  # Global Secondary Index for username queries
  global_secondary_index {
    name            = "username-upload_date-index"
    hash_key        = "username"
    range_key       = "upload_date"
    projection_type = "ALL"
  }

  tags = {
    Name        = "Video Metadata Table"
    Environment = var.environment
    Project     = var.project_name
  }
}

# Lambda execution role
resource "aws_iam_role" "lambda_execution_role" {
  name = "${var.project_name}-lambda-execution-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Environment = var.environment
    Project     = var.project_name
  }
}

# Lambda policy for DynamoDB and CloudWatch
resource "aws_iam_role_policy" "lambda_policy" {
  name = "${var.project_name}-lambda-policy"
  role = aws_iam_role.lambda_execution_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:*"
      },
      {
        Effect = "Allow"
        Action = [
          "dynamodb:PutItem",
          "dynamodb:GetItem",
          "dynamodb:Query",
          "dynamodb:Scan",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem"
        ]
        Resource = [
          aws_dynamodb_table.video_metadata.arn,
          "${aws_dynamodb_table.video_metadata.arn}/index/*"
        ]
      }
    ]
  })
}

# Lambda function for video metadata operations
resource "aws_lambda_function" "video_metadata_api" {
  filename         = "lambda_function.zip"
  function_name    = "${var.project_name}-video-metadata-api"
  role            = aws_iam_role.lambda_execution_role.arn
  handler         = "index.handler"
  runtime         = "nodejs18.x"
  timeout         = 30

  source_code_hash = data.archive_file.lambda_zip.output_base64sha256

  environment {
    variables = {
      DYNAMODB_TABLE = aws_dynamodb_table.video_metadata.name
      CORS_ORIGIN    = "*"
    }
  }

  tags = {
    Environment = var.environment
    Project     = var.project_name
  }
}

# Create Lambda deployment package
data "archive_file" "lambda_zip" {
  type        = "zip"
  output_path = "lambda_function.zip"
  source {
    content = templatefile("${path.module}/lambda/index.js", {
      dynamodb_table = aws_dynamodb_table.video_metadata.name
    })
    filename = "index.js"
  }
}

# API Gateway REST API
resource "aws_api_gateway_rest_api" "video_api" {
  name        = "${var.project_name}-api"
  description = "API for video metadata operations"

  endpoint_configuration {
    types = ["REGIONAL"]
  }

  tags = {
    Environment = var.environment
    Project     = var.project_name
  }
}

# API Gateway resource for videos
resource "aws_api_gateway_resource" "videos_resource" {
  rest_api_id = aws_api_gateway_rest_api.video_api.id
  parent_id   = aws_api_gateway_rest_api.video_api.root_resource_id
  path_part   = "videos"
}

# API Gateway method for POST (create video metadata)
resource "aws_api_gateway_method" "videos_post" {
  rest_api_id   = aws_api_gateway_rest_api.video_api.id
  resource_id   = aws_api_gateway_resource.videos_resource.id
  http_method   = "POST"
  authorization = "NONE"
}

# API Gateway method for GET (list videos)
resource "aws_api_gateway_method" "videos_get" {
  rest_api_id   = aws_api_gateway_rest_api.video_api.id
  resource_id   = aws_api_gateway_resource.videos_resource.id
  http_method   = "GET"
  authorization = "NONE"
}

# API Gateway method for OPTIONS (CORS)
resource "aws_api_gateway_method" "videos_options" {
  rest_api_id   = aws_api_gateway_rest_api.video_api.id
  resource_id   = aws_api_gateway_resource.videos_resource.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

# API Gateway integration for POST
resource "aws_api_gateway_integration" "videos_post_integration" {
  rest_api_id = aws_api_gateway_rest_api.video_api.id
  resource_id = aws_api_gateway_resource.videos_resource.id
  http_method = aws_api_gateway_method.videos_post.http_method

  integration_http_method = "POST"
  type                   = "AWS_PROXY"
  uri                    = aws_lambda_function.video_metadata_api.invoke_arn
}

# API Gateway integration for GET
resource "aws_api_gateway_integration" "videos_get_integration" {
  rest_api_id = aws_api_gateway_rest_api.video_api.id
  resource_id = aws_api_gateway_resource.videos_resource.id
  http_method = aws_api_gateway_method.videos_get.http_method

  integration_http_method = "POST"
  type                   = "AWS_PROXY"
  uri                    = aws_lambda_function.video_metadata_api.invoke_arn
}

# API Gateway integration for OPTIONS (CORS)
resource "aws_api_gateway_integration" "videos_options_integration" {
  rest_api_id = aws_api_gateway_rest_api.video_api.id
  resource_id = aws_api_gateway_resource.videos_resource.id
  http_method = aws_api_gateway_method.videos_options.http_method

  type = "MOCK"
  request_templates = {
    "application/json" = "{\"statusCode\": 200}"
  }
}

# API Gateway method response for POST
resource "aws_api_gateway_method_response" "videos_post_response" {
  rest_api_id = aws_api_gateway_rest_api.video_api.id
  resource_id = aws_api_gateway_resource.videos_resource.id
  http_method = aws_api_gateway_method.videos_post.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Origin" = true
  }
}

# API Gateway method response for GET
resource "aws_api_gateway_method_response" "videos_get_response" {
  rest_api_id = aws_api_gateway_rest_api.video_api.id
  resource_id = aws_api_gateway_resource.videos_resource.id
  http_method = aws_api_gateway_method.videos_get.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Origin" = true
  }
}

# API Gateway method response for OPTIONS
resource "aws_api_gateway_method_response" "videos_options_response" {
  rest_api_id = aws_api_gateway_rest_api.video_api.id
  resource_id = aws_api_gateway_resource.videos_resource.id
  http_method = aws_api_gateway_method.videos_options.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Origin"  = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Headers" = true
  }
}

# API Gateway integration response for OPTIONS
resource "aws_api_gateway_integration_response" "videos_options_integration_response" {
  rest_api_id = aws_api_gateway_rest_api.video_api.id
  resource_id = aws_api_gateway_resource.videos_resource.id
  http_method = aws_api_gateway_method.videos_options.http_method
  status_code = aws_api_gateway_method_response.videos_options_response.status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,POST,OPTIONS'"
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'"
  }
}

# Lambda permission for API Gateway
resource "aws_lambda_permission" "api_gateway_lambda" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.video_metadata_api.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.video_api.execution_arn}/*/*"
}

# API Gateway deployment
resource "aws_api_gateway_deployment" "video_api_deployment" {
  depends_on = [
    aws_api_gateway_integration.videos_post_integration,
    aws_api_gateway_integration.videos_get_integration,
    aws_api_gateway_integration.videos_options_integration,
  ]

  rest_api_id = aws_api_gateway_rest_api.video_api.id

  triggers = {
    redeployment = sha1(jsonencode([
      aws_api_gateway_resource.videos_resource.id,
      aws_api_gateway_method.videos_post.id,
      aws_api_gateway_method.videos_get.id,
      aws_api_gateway_method.videos_options.id,
      aws_api_gateway_integration.videos_post_integration.id,
      aws_api_gateway_integration.videos_get_integration.id,
      aws_api_gateway_integration.videos_options_integration.id,
    ]))
  }

  lifecycle {
    create_before_destroy = true
  }
}

# API Gateway stage
resource "aws_api_gateway_stage" "video_api_stage" {
  deployment_id = aws_api_gateway_deployment.video_api_deployment.id
  rest_api_id   = aws_api_gateway_rest_api.video_api.id
  stage_name    = var.environment

  tags = {
    Environment = var.environment
    Project     = var.project_name
  }
} 