variable "aws_region" {
  description = "AWS region to deploy into"
  type        = string
  default     = "us-east-1"
}

variable "project_name" {
  description = "Short name used as a prefix for all resource names"
  type        = string
  default     = "archivault"
}

variable "environment" {
  description = "Environment tag applied to all resources (e.g. prod, dev)"
  type        = string
  default     = "prod"
}

# ── IAM Identity Center ───────────────────────────────────────────────────────

variable "sso_username" {
  description = <<-EOT
    IAM Identity Center username to assign the archivault permission set to.
    Find it in the AWS console under IAM Identity Center > Users, or:
      aws identitystore list-users \
        --identity-store-id <id from `aws sso-admin list-instances`> \
        --query 'Users[*].{User:UserName,Id:UserId}'
  EOT
  type        = string
}

# ── S3 ────────────────────────────────────────────────────────────────────────

variable "enable_s3_versioning" {
  description = "Enable S3 versioning on the archive bucket (recommended for archival use)"
  type        = bool
  default     = true
}

# ── RDS ───────────────────────────────────────────────────────────────────────

variable "rds_instance_class" {
  description = "RDS instance class. db.t4g.micro (~$15/mo) is sufficient for personal use."
  type        = string
  default     = "db.t4g.micro"
}

variable "rds_publicly_accessible" {
  description = <<-EOT
    Whether the RDS instance has a public IP. Set to true when connecting
    directly from a laptop. The security group still restricts access to
    allowed_cidr_blocks regardless of this setting.
  EOT
  type        = bool
  default     = true
}

variable "allowed_cidr_blocks" {
  description = <<-EOT
    CIDRs allowed to connect to RDS on port 5432.
    Add your home IP: ["1.2.3.4/32"]
    Or open to all (rely on password auth only): ["0.0.0.0/0"]
  EOT
  type        = list(string)
}

variable "enable_deletion_protection" {
  description = "Protect the RDS instance from accidental deletion via Terraform"
  type        = bool
  default     = true
}
