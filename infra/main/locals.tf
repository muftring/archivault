locals {
  # Bucket name is globally unique by embedding the account ID
  bucket_name = "${var.project_name}-archive-${data.aws_caller_identity.current.account_id}"

  common_tags = {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}
