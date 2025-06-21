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
    name = "user_id"
    type = "S"
  }

  attribute {
    name = "upload_date"
    type = "S"
  }

  # Global Secondary Index for user_id queries
  global_secondary_index {
    name            = "user_id-upload_date-index"
    hash_key        = "user_id"
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
      },
      {
        Effect = "Allow"
        Action = [
          "cognito-idp:ListUsers",
          "cognito-idp:AdminGetUser",
          "cognito-idp:AdminDeleteUser",
          "cognito-idp:AdminDisableUser",
          "cognito-idp:AdminEnableUser",
          "cognito-idp:AdminAddUserToGroup",
          "cognito-idp:AdminRemoveUserFromGroup",
          "cognito-idp:AdminListGroupsForUser",
          "cognito-idp:ListUsersInGroup"
        ]
        Resource = aws_cognito_user_pool.video_app_users.arn
      },
      {
        Effect = "Allow"
        Action = [
          "s3:DeleteObject"
        ]
        Resource = "${aws_s3_bucket.video_bucket.arn}/*"
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

# Lambda function for admin operations
resource "aws_lambda_function" "admin_api" {
  filename         = "admin_lambda_function.zip"
  function_name    = "${var.project_name}-admin-api"
  role            = aws_iam_role.lambda_execution_role.arn
  handler         = "admin.handler"
  runtime         = "nodejs18.x"
  timeout         = 30

  source_code_hash = data.archive_file.admin_lambda_zip.output_base64sha256

  environment {
    variables = {
      DYNAMODB_TABLE = aws_dynamodb_table.video_metadata.name
      COGNITO_USER_POOL_ID = aws_cognito_user_pool.video_app_users.id
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
  source_dir  = "${path.module}/lambda"
}

# Create Admin Lambda deployment package
data "archive_file" "admin_lambda_zip" {
  type        = "zip"
  output_path = "admin_lambda_function.zip"
  source_dir  = "${path.module}/admin-lambda"
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

# API Gateway resource for admin
resource "aws_api_gateway_resource" "admin_resource" {
  rest_api_id = aws_api_gateway_rest_api.video_api.id
  parent_id   = aws_api_gateway_rest_api.video_api.root_resource_id
  path_part   = "admin"
}

# API Gateway resource for admin/users
resource "aws_api_gateway_resource" "admin_users_resource" {
  rest_api_id = aws_api_gateway_rest_api.video_api.id
  parent_id   = aws_api_gateway_resource.admin_resource.id
  path_part   = "users"
}

# API Gateway resource for admin/videos
resource "aws_api_gateway_resource" "admin_videos_resource" {
  rest_api_id = aws_api_gateway_rest_api.video_api.id
  parent_id   = aws_api_gateway_resource.admin_resource.id
  path_part   = "videos"
}

# API Gateway resource for admin/users/{userId}/videos
resource "aws_api_gateway_resource" "admin_user_videos_resource" {
  rest_api_id = aws_api_gateway_rest_api.video_api.id
  parent_id   = aws_api_gateway_resource.admin_users_resource.id
  path_part   = "{userId}"
}

resource "aws_api_gateway_resource" "admin_user_videos_sub_resource" {
  rest_api_id = aws_api_gateway_rest_api.video_api.id
  parent_id   = aws_api_gateway_resource.admin_user_videos_resource.id
  path_part   = "videos"
}

# API Gateway method for POST (create video metadata)
resource "aws_api_gateway_method" "videos_post" {
  rest_api_id   = aws_api_gateway_rest_api.video_api.id
  resource_id   = aws_api_gateway_resource.videos_resource.id
  http_method   = "POST"
  authorization = "COGNITO_USER_POOLS"
  authorizer_id = aws_api_gateway_authorizer.cognito_authorizer.id
}

# API Gateway method for GET (list videos)
resource "aws_api_gateway_method" "videos_get" {
  rest_api_id   = aws_api_gateway_rest_api.video_api.id
  resource_id   = aws_api_gateway_resource.videos_resource.id
  http_method   = "GET"
  authorization = "COGNITO_USER_POOLS"
  authorizer_id = aws_api_gateway_authorizer.cognito_authorizer.id
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

# Admin API Gateway Integrations
resource "aws_api_gateway_integration" "admin_users_get_integration" {
  rest_api_id = aws_api_gateway_rest_api.video_api.id
  resource_id = aws_api_gateway_resource.admin_users_resource.id
  http_method = aws_api_gateway_method.admin_users_get.http_method

  integration_http_method = "POST"
  type                   = "AWS_PROXY"
  uri                    = aws_lambda_function.admin_api.invoke_arn
}

resource "aws_api_gateway_integration" "admin_videos_get_integration" {
  rest_api_id = aws_api_gateway_rest_api.video_api.id
  resource_id = aws_api_gateway_resource.admin_videos_resource.id
  http_method = aws_api_gateway_method.admin_videos_get.http_method

  integration_http_method = "POST"
  type                   = "AWS_PROXY"
  uri                    = aws_lambda_function.admin_api.invoke_arn
}

resource "aws_api_gateway_integration" "admin_videos_delete_integration" {
  rest_api_id = aws_api_gateway_rest_api.video_api.id
  resource_id = aws_api_gateway_resource.admin_videos_resource.id
  http_method = aws_api_gateway_method.admin_videos_delete.http_method

  integration_http_method = "POST"
  type                   = "AWS_PROXY"
  uri                    = aws_lambda_function.admin_api.invoke_arn
}

resource "aws_api_gateway_integration" "admin_user_videos_get_integration" {
  rest_api_id = aws_api_gateway_rest_api.video_api.id
  resource_id = aws_api_gateway_resource.admin_user_videos_sub_resource.id
  http_method = aws_api_gateway_method.admin_user_videos_get.http_method

  integration_http_method = "POST"
  type                   = "AWS_PROXY"
  uri                    = aws_lambda_function.admin_api.invoke_arn
}

# Admin CORS integrations
resource "aws_api_gateway_integration" "admin_users_options_integration" {
  rest_api_id = aws_api_gateway_rest_api.video_api.id
  resource_id = aws_api_gateway_resource.admin_users_resource.id
  http_method = aws_api_gateway_method.admin_users_options.http_method

  type = "MOCK"
  request_templates = {
    "application/json" = "{\"statusCode\": 200}"
  }
}

resource "aws_api_gateway_integration" "admin_videos_options_integration" {
  rest_api_id = aws_api_gateway_rest_api.video_api.id
  resource_id = aws_api_gateway_resource.admin_videos_resource.id
  http_method = aws_api_gateway_method.admin_videos_options.http_method

  type = "MOCK"
  request_templates = {
    "application/json" = "{\"statusCode\": 200}"
  }
}

resource "aws_api_gateway_integration" "admin_user_videos_options_integration" {
  rest_api_id = aws_api_gateway_rest_api.video_api.id
  resource_id = aws_api_gateway_resource.admin_user_videos_sub_resource.id
  http_method = aws_api_gateway_method.admin_user_videos_options.http_method

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

# Admin API Gateway Method Responses
resource "aws_api_gateway_method_response" "admin_users_get_response" {
  rest_api_id = aws_api_gateway_rest_api.video_api.id
  resource_id = aws_api_gateway_resource.admin_users_resource.id
  http_method = aws_api_gateway_method.admin_users_get.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Origin" = true
  }
}

resource "aws_api_gateway_method_response" "admin_videos_get_response" {
  rest_api_id = aws_api_gateway_rest_api.video_api.id
  resource_id = aws_api_gateway_resource.admin_videos_resource.id
  http_method = aws_api_gateway_method.admin_videos_get.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Origin" = true
  }
}

resource "aws_api_gateway_method_response" "admin_videos_delete_response" {
  rest_api_id = aws_api_gateway_rest_api.video_api.id
  resource_id = aws_api_gateway_resource.admin_videos_resource.id
  http_method = aws_api_gateway_method.admin_videos_delete.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Origin" = true
  }
}

resource "aws_api_gateway_method_response" "admin_user_videos_get_response" {
  rest_api_id = aws_api_gateway_rest_api.video_api.id
  resource_id = aws_api_gateway_resource.admin_user_videos_sub_resource.id
  http_method = aws_api_gateway_method.admin_user_videos_get.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Origin" = true
  }
}

# Admin OPTIONS method responses
resource "aws_api_gateway_method_response" "admin_users_options_response" {
  rest_api_id = aws_api_gateway_rest_api.video_api.id
  resource_id = aws_api_gateway_resource.admin_users_resource.id
  http_method = aws_api_gateway_method.admin_users_options.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Origin"  = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Headers" = true
  }
}

resource "aws_api_gateway_method_response" "admin_videos_options_response" {
  rest_api_id = aws_api_gateway_rest_api.video_api.id
  resource_id = aws_api_gateway_resource.admin_videos_resource.id
  http_method = aws_api_gateway_method.admin_videos_options.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Origin"  = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Headers" = true
  }
}

resource "aws_api_gateway_method_response" "admin_user_videos_options_response" {
  rest_api_id = aws_api_gateway_rest_api.video_api.id
  resource_id = aws_api_gateway_resource.admin_user_videos_sub_resource.id
  http_method = aws_api_gateway_method.admin_user_videos_options.http_method
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

# Admin API Gateway Integration Responses
resource "aws_api_gateway_integration_response" "admin_users_get_integration_response" {
  rest_api_id = aws_api_gateway_rest_api.video_api.id
  resource_id = aws_api_gateway_resource.admin_users_resource.id
  http_method = aws_api_gateway_method.admin_users_get.http_method
  status_code = aws_api_gateway_method_response.admin_users_get_response.status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Origin" = "'*'"
  }
}

resource "aws_api_gateway_integration_response" "admin_videos_get_integration_response" {
  rest_api_id = aws_api_gateway_rest_api.video_api.id
  resource_id = aws_api_gateway_resource.admin_videos_resource.id
  http_method = aws_api_gateway_method.admin_videos_get.http_method
  status_code = aws_api_gateway_method_response.admin_videos_get_response.status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Origin" = "'*'"
  }
}

resource "aws_api_gateway_integration_response" "admin_videos_delete_integration_response" {
  rest_api_id = aws_api_gateway_rest_api.video_api.id
  resource_id = aws_api_gateway_resource.admin_videos_resource.id
  http_method = aws_api_gateway_method.admin_videos_delete.http_method
  status_code = aws_api_gateway_method_response.admin_videos_delete_response.status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Origin" = "'*'"
  }
}

resource "aws_api_gateway_integration_response" "admin_user_videos_get_integration_response" {
  rest_api_id = aws_api_gateway_rest_api.video_api.id
  resource_id = aws_api_gateway_resource.admin_user_videos_sub_resource.id
  http_method = aws_api_gateway_method.admin_user_videos_get.http_method
  status_code = aws_api_gateway_method_response.admin_user_videos_get_response.status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Origin" = "'*'"
  }
}

# Admin OPTIONS integration responses
resource "aws_api_gateway_integration_response" "admin_users_options_integration_response" {
  rest_api_id = aws_api_gateway_rest_api.video_api.id
  resource_id = aws_api_gateway_resource.admin_users_resource.id
  http_method = aws_api_gateway_method.admin_users_options.http_method
  status_code = aws_api_gateway_method_response.admin_users_options_response.status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,DELETE,OPTIONS'"
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'"
  }
}

resource "aws_api_gateway_integration_response" "admin_videos_options_integration_response" {
  rest_api_id = aws_api_gateway_rest_api.video_api.id
  resource_id = aws_api_gateway_resource.admin_videos_resource.id
  http_method = aws_api_gateway_method.admin_videos_options.http_method
  status_code = aws_api_gateway_method_response.admin_videos_options_response.status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,DELETE,OPTIONS'"
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'"
  }
}

resource "aws_api_gateway_integration_response" "admin_user_videos_options_integration_response" {
  rest_api_id = aws_api_gateway_rest_api.video_api.id
  resource_id = aws_api_gateway_resource.admin_user_videos_sub_resource.id
  http_method = aws_api_gateway_method.admin_user_videos_options.http_method
  status_code = aws_api_gateway_method_response.admin_user_videos_options_response.status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,OPTIONS'"
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

# Lambda permission for Admin API Gateway
resource "aws_lambda_permission" "admin_api_gateway_lambda" {
  statement_id  = "AllowExecutionFromAPIGatewayAdmin"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.admin_api.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.video_api.execution_arn}/*/*"
}

# API Gateway deployment
resource "aws_api_gateway_deployment" "video_api_deployment" {
  depends_on = [
    aws_api_gateway_integration.videos_post_integration,
    aws_api_gateway_integration.videos_get_integration,
    aws_api_gateway_integration.videos_options_integration,
    aws_api_gateway_integration.admin_users_get_integration,
    aws_api_gateway_integration.admin_videos_get_integration,
    aws_api_gateway_integration.admin_videos_delete_integration,
    aws_api_gateway_integration.admin_user_videos_get_integration,
    aws_api_gateway_integration.admin_users_options_integration,
    aws_api_gateway_integration.admin_videos_options_integration,
    aws_api_gateway_integration.admin_user_videos_options_integration,
    # Add admin integration responses
    aws_api_gateway_integration_response.admin_users_get_integration_response,
    aws_api_gateway_integration_response.admin_videos_get_integration_response,
    aws_api_gateway_integration_response.admin_videos_delete_integration_response,
    aws_api_gateway_integration_response.admin_user_videos_get_integration_response,
    aws_api_gateway_integration_response.admin_users_options_integration_response,
    aws_api_gateway_integration_response.admin_videos_options_integration_response,
    aws_api_gateway_integration_response.admin_user_videos_options_integration_response,
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
      aws_api_gateway_authorizer.cognito_authorizer.id,
      # Admin resources
      aws_api_gateway_resource.admin_resource.id,
      aws_api_gateway_resource.admin_users_resource.id,
      aws_api_gateway_resource.admin_videos_resource.id,
      aws_api_gateway_resource.admin_user_videos_resource.id,
      aws_api_gateway_resource.admin_user_videos_sub_resource.id,
      aws_api_gateway_method.admin_users_get.id,
      aws_api_gateway_method.admin_videos_get.id,
      aws_api_gateway_method.admin_videos_delete.id,
      aws_api_gateway_method.admin_user_videos_get.id,
      aws_api_gateway_integration.admin_users_get_integration.id,
      aws_api_gateway_integration.admin_videos_get_integration.id,
      aws_api_gateway_integration.admin_videos_delete_integration.id,
      aws_api_gateway_integration.admin_user_videos_get_integration.id,
      # Admin method responses
      aws_api_gateway_method_response.admin_users_get_response.id,
      aws_api_gateway_method_response.admin_videos_get_response.id,
      aws_api_gateway_method_response.admin_videos_delete_response.id,
      aws_api_gateway_method_response.admin_user_videos_get_response.id,
      aws_api_gateway_method_response.admin_users_options_response.id,
      aws_api_gateway_method_response.admin_videos_options_response.id,
      aws_api_gateway_method_response.admin_user_videos_options_response.id,
      # Admin integration responses
      aws_api_gateway_integration_response.admin_users_get_integration_response.id,
      aws_api_gateway_integration_response.admin_videos_get_integration_response.id,
      aws_api_gateway_integration_response.admin_videos_delete_integration_response.id,
      aws_api_gateway_integration_response.admin_user_videos_get_integration_response.id,
      aws_api_gateway_integration_response.admin_users_options_integration_response.id,
      aws_api_gateway_integration_response.admin_videos_options_integration_response.id,
      aws_api_gateway_integration_response.admin_user_videos_options_integration_response.id,
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



# Cognito User Pool for authentication
resource "aws_cognito_user_pool" "video_app_users" {
  name = "${var.project_name}-users"

  # Email as username
  alias_attributes         = ["email"]
  auto_verified_attributes = ["email"]

  # Password policy (strong default)
  password_policy {
    minimum_length    = 8
    require_lowercase = true
    require_numbers   = true
    require_symbols   = true
    require_uppercase = true
  }

  # Email verification settings
  verification_message_template {
    default_email_option = "CONFIRM_WITH_CODE"
    email_subject        = "Easy Video Share - Verify your email"
    email_message        = "Your verification code is {####}"
  }

  # Account recovery
  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
  }

  # Email configuration for passwordless authentication
  email_configuration {
    email_sending_account = "COGNITO_DEFAULT"
  }

  # User attribute update settings
  user_attribute_update_settings {
    attributes_require_verification_before_update = ["email"]
  }

  # Enable USER_AUTH sign-in options for passwordless authentication
  user_pool_add_ons {
    advanced_security_mode = "OFF"
  }

  tags = {
    Name        = "Video App User Pool"
    Environment = var.environment
    Project     = var.project_name
  }
}

# Cognito User Pool Group for Admins
resource "aws_cognito_user_group" "admin_group" {
  name         = "admin"
  user_pool_id = aws_cognito_user_pool.video_app_users.id
  description  = "Administrator group with full access to all users and videos"
  precedence   = 1
}

# Cognito User Pool Group for Regular Users
resource "aws_cognito_user_group" "user_group" {
  name         = "user"
  user_pool_id = aws_cognito_user_pool.video_app_users.id
  description  = "Regular user group with access to own videos only"
  precedence   = 2
}

# Cognito User Pool Client for frontend application
resource "aws_cognito_user_pool_client" "video_app_client" {
  name         = "${var.project_name}-client"
  user_pool_id = aws_cognito_user_pool.video_app_users.id

  # Authentication flows for web application (including passwordless)
  explicit_auth_flows = [
    "ALLOW_USER_SRP_AUTH",
    "ALLOW_USER_PASSWORD_AUTH", 
    "ALLOW_REFRESH_TOKEN_AUTH",
    "ALLOW_USER_AUTH"  # Enable native passwordless auth
  ]

  # Authentication methods for USER_AUTH flow - specify EMAIL_OTP
  auth_session_validity = 3  # 3 minutes for OTP

  # Token configuration
  access_token_validity  = 1    # 1 hour
  id_token_validity     = 1    # 1 hour
  refresh_token_validity = 30   # 30 days

  token_validity_units {
    access_token  = "hours"
    id_token      = "hours"
    refresh_token = "days"
  }

  # Prevent secret generation (not needed for web apps)
  generate_secret = false

  # Allowed OAuth flows (for future expansion)
  supported_identity_providers = ["COGNITO"]
  
  # Enable read/write for email and name attributes
  read_attributes  = ["email", "name"]
  write_attributes = ["email", "name"]
}

# API Gateway Cognito Authorizer
resource "aws_api_gateway_authorizer" "cognito_authorizer" {
  name            = "${var.project_name}-cognito-auth"
  type            = "COGNITO_USER_POOLS"
  rest_api_id     = aws_api_gateway_rest_api.video_api.id
  provider_arns   = [aws_cognito_user_pool.video_app_users.arn]
  identity_source = "method.request.header.Authorization"
}

# Admin API Gateway Methods
# GET /admin/users - List all users
resource "aws_api_gateway_method" "admin_users_get" {
  rest_api_id   = aws_api_gateway_rest_api.video_api.id
  resource_id   = aws_api_gateway_resource.admin_users_resource.id
  http_method   = "GET"
  authorization = "COGNITO_USER_POOLS"
  authorizer_id = aws_api_gateway_authorizer.cognito_authorizer.id
}

# GET /admin/videos - List all videos
resource "aws_api_gateway_method" "admin_videos_get" {
  rest_api_id   = aws_api_gateway_rest_api.video_api.id
  resource_id   = aws_api_gateway_resource.admin_videos_resource.id
  http_method   = "GET"
  authorization = "COGNITO_USER_POOLS"
  authorizer_id = aws_api_gateway_authorizer.cognito_authorizer.id
}

# DELETE /admin/videos - Delete video (in request body)
resource "aws_api_gateway_method" "admin_videos_delete" {
  rest_api_id   = aws_api_gateway_rest_api.video_api.id
  resource_id   = aws_api_gateway_resource.admin_videos_resource.id
  http_method   = "DELETE"
  authorization = "COGNITO_USER_POOLS"
  authorizer_id = aws_api_gateway_authorizer.cognito_authorizer.id
}

# GET /admin/users/{userId}/videos - Get videos for specific user
resource "aws_api_gateway_method" "admin_user_videos_get" {
  rest_api_id   = aws_api_gateway_rest_api.video_api.id
  resource_id   = aws_api_gateway_resource.admin_user_videos_sub_resource.id
  http_method   = "GET"
  authorization = "COGNITO_USER_POOLS"
  authorizer_id = aws_api_gateway_authorizer.cognito_authorizer.id
}

# OPTIONS methods for CORS
resource "aws_api_gateway_method" "admin_users_options" {
  rest_api_id   = aws_api_gateway_rest_api.video_api.id
  resource_id   = aws_api_gateway_resource.admin_users_resource.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_method" "admin_videos_options" {
  rest_api_id   = aws_api_gateway_rest_api.video_api.id
  resource_id   = aws_api_gateway_resource.admin_videos_resource.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_method" "admin_user_videos_options" {
  rest_api_id   = aws_api_gateway_rest_api.video_api.id
  resource_id   = aws_api_gateway_resource.admin_user_videos_sub_resource.id
  http_method   = "OPTIONS"
  authorization = "NONE"
} 