# ── S3 ────────────────────────────────────────────────────────────────────────

output "s3_bucket_name" {
  description = "Name of the S3 archive bucket"
  value       = aws_s3_bucket.archive.id
}

output "aws_region" {
  description = "AWS region"
  value       = data.aws_region.current.name
}

# ── IAM Identity Center ───────────────────────────────────────────────────────

output "sso_permission_set_name" {
  description = "IAM Identity Center permission set name"
  value       = aws_ssoadmin_permission_set.archivault.name
}

# ── RDS ───────────────────────────────────────────────────────────────────────

output "rds_host" {
  description = "RDS PostgreSQL hostname"
  value       = aws_db_instance.archivault.address
}

output "rds_port" {
  description = "RDS PostgreSQL port"
  value       = aws_db_instance.archivault.port
}

output "rds_database" {
  description = "RDS database name"
  value       = aws_db_instance.archivault.db_name
}

output "rds_username" {
  description = "RDS master username"
  value       = aws_db_instance.archivault.username
}

output "rds_password" {
  description = "RDS master password (sensitive — retrieve with: terraform output -raw rds_password)"
  value       = random_password.db.result
  sensitive   = true
}

# ── Next steps ────────────────────────────────────────────────────────────────

output "next_steps" {
  description = "Commands to configure archivault after apply"
  value       = <<-EOT

    # 1. Configure S3
    archivault config \
      --bucket ${aws_s3_bucket.archive.id} \
      --region ${data.aws_region.current.name} \
      --profile <your-sso-profile>

    # 2. Configure PostgreSQL
    archivault config \
      --db-type postgres \
      --pg-host ${aws_db_instance.archivault.address} \
      --pg-port ${aws_db_instance.archivault.port} \
      --pg-database ${aws_db_instance.archivault.db_name} \
      --pg-username ${aws_db_instance.archivault.username} \
      --pg-password "$(terraform -chdir=infra/main output -raw rds_password)"

    # 3. Create the database schema
    archivault db setup

  EOT
}
