# Customer Personas

## Founder-Operator (Seed → Series A)
- Wants: fast setup, clear threat visibility, minimal infra
- Bias: prefers Docker Compose and simple k8s manifests
- Success: actionable alerts with receipts they can show investors

## Lean Ops Team (5-20 engineers)
- Wants: guardrails + approvals, minimal false positives
- Bias: integrates with Slack/Email, expects Terraform-ready manifests
- Success: clear runbooks, RBAC for approvals, solid audit trail

## MSP / MSSP
- Wants: multi-tenant isolation, templated deployments per client
- Bias: Fleet-oriented (DaemonSet Guardian), wants signed receipts
- Success: can onboard a new tenant in <1 hour with zero code changes
