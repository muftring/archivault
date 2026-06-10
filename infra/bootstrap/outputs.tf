output "state_bucket_name" {
  description = "Name of the S3 bucket for Terraform state — copy into infra/main/backend.hcl"
  value       = aws_s3_bucket.tfstate.id
}

output "lock_table_name" {
  description = "Name of the DynamoDB lock table — copy into infra/main/backend.hcl"
  value       = aws_dynamodb_table.tflock.name
}

output "aws_region" {
  description = "Region where these resources were created"
  value       = var.aws_region
}
