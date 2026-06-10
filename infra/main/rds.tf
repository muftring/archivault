# ── Password ──────────────────────────────────────────────────────────────────

resource "random_password" "db" {
  length  = 32
  special = false # avoid shell-quoting issues when pasting into CLI config
}

# ── Subnet group ──────────────────────────────────────────────────────────────

resource "aws_db_subnet_group" "archivault" {
  name        = var.project_name
  description = "Subnet group for ${var.project_name} RDS"
  subnet_ids  = data.aws_subnets.default.ids

  tags = local.common_tags
}

# ── RDS instance ──────────────────────────────────────────────────────────────

resource "aws_db_instance" "archivault" {
  identifier     = var.project_name
  engine         = "postgres"
  engine_version = "16"
  instance_class = var.rds_instance_class

  allocated_storage     = 20
  max_allocated_storage = 100 # autoscales up to 100 GB
  storage_type          = "gp3"
  storage_encrypted     = true

  db_name  = "archivault"
  username = "archivault"
  password = random_password.db.result

  db_subnet_group_name   = aws_db_subnet_group.archivault.name
  vpc_security_group_ids = [aws_security_group.rds.id]
  publicly_accessible    = var.rds_publicly_accessible

  backup_retention_period    = 7
  backup_window              = "03:00-04:00"
  maintenance_window         = "Mon:04:00-Mon:05:00"
  auto_minor_version_upgrade = true

  skip_final_snapshot       = false
  final_snapshot_identifier = "${var.project_name}-final-snapshot"
  deletion_protection       = var.enable_deletion_protection

  tags = local.common_tags
}
