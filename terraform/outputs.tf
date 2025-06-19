output "bucket_name" {
  description = "Name of the created S3 bucket"
  value       = aws_s3_bucket.video_bucket.bucket
}

output "bucket_arn" {
  description = "ARN of the created S3 bucket"
  value       = aws_s3_bucket.video_bucket.arn
}

output "bucket_website_endpoint" {
  description = "Website endpoint for the S3 bucket"
  value       = aws_s3_bucket_website_configuration.video_bucket_website.website_endpoint
}

output "bucket_domain_name" {
  description = "Domain name of the S3 bucket"
  value       = aws_s3_bucket.video_bucket.bucket_domain_name
}

output "bucket_regional_domain_name" {
  description = "Regional domain name of the S3 bucket"
  value       = aws_s3_bucket.video_bucket.bucket_regional_domain_name
}

output "app_user_access_key_id" {
  description = "Access key ID for the application user"
  value       = aws_iam_access_key.video_app_user_key.id
}

output "app_user_secret_access_key" {
  description = "Secret access key for the application user"
  value       = aws_iam_access_key.video_app_user_key.secret
  sensitive   = true
}

output "aws_region" {
  description = "AWS region where resources are created"
  value       = var.aws_region
} 