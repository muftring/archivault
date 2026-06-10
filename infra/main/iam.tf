# ── IAM Identity Center ───────────────────────────────────────────────────────

data "aws_ssoadmin_instances" "this" {}

locals {
  sso_instance_arn  = tolist(data.aws_ssoadmin_instances.this.arns)[0]
  identity_store_id = tolist(data.aws_ssoadmin_instances.this.identity_store_ids)[0]
}

data "aws_identitystore_user" "archivault" {
  identity_store_id = local.identity_store_id

  alternate_identifier {
    unique_attribute {
      attribute_path  = "UserName"
      attribute_value = var.sso_username
    }
  }
}

# ── S3 policy ─────────────────────────────────────────────────────────────────

data "aws_iam_policy_document" "s3_access" {
  statement {
    sid    = "ArchivaultS3Access"
    effect = "Allow"

    actions = [
      "s3:ListBucket",
      "s3:GetObject",
      "s3:PutObject",
      "s3:DeleteObject",
      "s3:HeadObject",
      "s3:AbortMultipartUpload",
      "s3:ListMultipartUploadParts",
    ]

    resources = [
      aws_s3_bucket.archive.arn,
      "${aws_s3_bucket.archive.arn}/*",
    ]
  }
}

# ── Permission set ────────────────────────────────────────────────────────────

resource "aws_ssoadmin_permission_set" "archivault" {
  name             = var.project_name
  description      = "Least-privilege access to the ${var.project_name} S3 archive"
  instance_arn     = local.sso_instance_arn
  session_duration = "PT8H"

  tags = local.common_tags
}

resource "aws_ssoadmin_permission_set_inline_policy" "archivault" {
  instance_arn       = local.sso_instance_arn
  permission_set_arn = aws_ssoadmin_permission_set.archivault.arn
  inline_policy      = data.aws_iam_policy_document.s3_access.json
}

# ── Account assignment ────────────────────────────────────────────────────────

resource "aws_ssoadmin_account_assignment" "archivault" {
  instance_arn       = local.sso_instance_arn
  permission_set_arn = aws_ssoadmin_permission_set.archivault.arn

  principal_id   = data.aws_identitystore_user.archivault.user_id
  principal_type = "USER"

  target_id   = data.aws_caller_identity.current.account_id
  target_type = "AWS_ACCOUNT"
}
