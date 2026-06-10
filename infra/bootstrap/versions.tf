terraform {
  required_version = ">= 1.9"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
  # Bootstrap uses local state intentionally — it only manages the state bucket
  # itself, so there is nothing to lose if this state file is deleted.
}

provider "aws" {
  region = var.aws_region
}
