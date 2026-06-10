# ── VPC ───────────────────────────────────────────────────────────────────────
# Uses the default VPC to keep things simple. If you need isolation, replace
# these data sources with a dedicated aws_vpc + aws_subnet resources.

data "aws_vpc" "default" {
  default = true
}

data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
}

# ── RDS security group ────────────────────────────────────────────────────────

resource "aws_security_group" "rds" {
  name_prefix = "${var.project_name}-rds-"
  description = "PostgreSQL access for ${var.project_name}"
  vpc_id      = data.aws_vpc.default.id

  ingress {
    description = "PostgreSQL"
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = var.allowed_cidr_blocks
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.common_tags, { Name = "${var.project_name}-rds" })

  lifecycle {
    create_before_destroy = true
  }
}
