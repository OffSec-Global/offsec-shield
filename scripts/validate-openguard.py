#!/usr/bin/env python3
"""
OpenGuard Configuration Validator

Validates OpenGuard TOML/YAML configuration files for OffSec Shield Guardian.
"""

import sys
import argparse
from pathlib import Path
from typing import Any, Dict, List, Optional

try:
    import toml
except ImportError:
    print("Error: toml package not found. Install with: pip install toml")
    sys.exit(1)

try:
    import yaml
except ImportError:
    yaml = None


class ConfigValidator:
    """Validates OpenGuard configuration structure and values."""

    REQUIRED_SECTIONS = [
        "guardian",
        "detectors",
        "actions",
    ]

    REQUIRED_GUARDIAN_FIELDS = ["id", "api_url"]

    VALID_DETECTORS = [
        "brute_force",
        "scanner",
        "anomaly_simple",
        "rate_limit",
        "geo_anomaly",
    ]

    VALID_ACTIONS = [
        "block_ip",
        "alert_human",
        "quarantine",
        "rate_limit",
        "log_only",
    ]

    VALID_LOG_SOURCES = ["ssh", "nginx", "firewall", "portal", "syslog"]

    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.errors: List[str] = []
        self.warnings: List[str] = []

    def validate(self) -> bool:
        """Run all validation checks."""
        self._check_required_sections()
        self._check_guardian_config()
        self._check_detectors()
        self._check_actions()
        self._check_log_sources()
        self._check_action_server()
        self._check_security()

        return len(self.errors) == 0

    def _check_required_sections(self):
        """Validate required top-level sections exist."""
        for section in self.REQUIRED_SECTIONS:
            if section not in self.config:
                self.errors.append(f"Missing required section: [{section}]")

    def _check_guardian_config(self):
        """Validate guardian configuration."""
        if "guardian" not in self.config:
            return

        guardian = self.config["guardian"]

        for field in self.REQUIRED_GUARDIAN_FIELDS:
            if field not in guardian:
                self.errors.append(f"Missing required field: guardian.{field}")

        # Check API URL format
        if "api_url" in guardian:
            url = guardian["api_url"]
            if not (url.startswith("http://") or url.startswith("https://")):
                self.warnings.append(
                    f"guardian.api_url should start with http:// or https:// (got: {url})"
                )

        # Check auth configuration
        if "auth" in guardian:
            auth = guardian["auth"]
            if not any(k in auth for k in ["capability_token", "jwt_hs256_secret"]):
                self.warnings.append(
                    "No authentication method configured in guardian.auth"
                )

    def _check_detectors(self):
        """Validate detector configuration."""
        if "detectors" not in self.config:
            return

        detectors = self.config["detectors"]

        if "enabled" not in detectors:
            self.warnings.append("No detectors enabled (detectors.enabled is empty)")
            return

        enabled = detectors["enabled"]
        if not isinstance(enabled, list):
            self.errors.append("detectors.enabled must be a list")
            return

        for detector in enabled:
            if detector not in self.VALID_DETECTORS:
                self.warnings.append(
                    f"Unknown detector '{detector}' (valid: {', '.join(self.VALID_DETECTORS)})"
                )

    def _check_actions(self):
        """Validate action configuration."""
        if "actions" not in self.config:
            return

        actions = self.config["actions"]

        if "allowed" not in actions:
            self.warnings.append("No actions configured (actions.allowed is empty)")
            return

        allowed = actions["allowed"]
        if not isinstance(allowed, list):
            self.errors.append("actions.allowed must be a list")
            return

        for action in allowed:
            if action not in self.VALID_ACTIONS:
                self.warnings.append(
                    f"Unknown action '{action}' (valid: {', '.join(self.VALID_ACTIONS)})"
                )

        # Check dangerous configurations
        if "global" in actions:
            global_cfg = actions["global"]
            if not global_cfg.get("require_approval", True):
                self.warnings.append(
                    "⚠️  actions.global.require_approval is disabled (auto-remediation active)"
                )

    def _check_log_sources(self):
        """Validate log source configuration."""
        if "log_sources" not in self.config:
            return

        log_sources = self.config["log_sources"]
        enabled_count = 0

        for source in self.VALID_LOG_SOURCES:
            if source in log_sources and log_sources[source].get("enabled"):
                enabled_count += 1
                # Check paths exist for file-based sources
                if source in ["ssh", "nginx", "firewall"]:
                    if "paths" not in log_sources[source]:
                        self.warnings.append(
                            f"log_sources.{source} enabled but no paths configured"
                        )

        if enabled_count == 0:
            self.warnings.append("No log sources enabled")

    def _check_action_server(self):
        """Validate action server configuration."""
        if "action_server" not in self.config:
            return

        server = self.config["action_server"]

        if server.get("enabled") and "listen" not in server:
            self.errors.append("action_server.listen must be set when enabled")

        # Check TLS configuration
        if "tls" in server and server["tls"].get("enabled"):
            tls = server["tls"]
            if not tls.get("cert_path") or not tls.get("key_path"):
                self.errors.append(
                    "action_server.tls.cert_path and key_path required when TLS enabled"
                )

    def _check_security(self):
        """Check for security issues."""
        # Check for weak secrets
        if "guardian" in self.config and "auth" in self.config["guardian"]:
            auth = self.config["guardian"]["auth"]
            secret = auth.get("jwt_hs256_secret", "")

            if secret in ["dev-secret", "test", "secret", "password"]:
                self.errors.append(f"⚠️  SECURITY: Weak JWT secret detected: '{secret}'")

        # Check for missing IP whitelist
        if "actions" in self.config and "block_ip" in self.config["actions"]:
            block_ip = self.config["actions"]["block_ip"]
            if block_ip.get("enabled"):
                whitelist = block_ip.get("whitelist", [])
                if not whitelist or len(whitelist) == 0:
                    self.warnings.append(
                        "⚠️  actions.block_ip.whitelist is empty (you might lock yourself out)"
                    )


def load_config(path: Path) -> Optional[Dict[str, Any]]:
    """Load TOML or YAML configuration file."""
    if not path.exists():
        print(f"Error: File not found: {path}")
        return None

    try:
        if path.suffix in [".toml"]:
            return toml.load(path)
        elif path.suffix in [".yaml", ".yml"]:
            if yaml is None:
                print("Error: yaml package not found. Install with: pip install pyyaml")
                return None
            with open(path, "r") as f:
                return yaml.safe_load(f)
        else:
            print(f"Error: Unsupported file format: {path.suffix}")
            return None
    except Exception as e:
        print(f"Error loading config: {e}")
        return None


def main():
    parser = argparse.ArgumentParser(description="Validate OpenGuard configuration")
    parser.add_argument(
        "config",
        type=Path,
        help="Path to configuration file (TOML or YAML)",
    )
    parser.add_argument(
        "--strict",
        action="store_true",
        help="Treat warnings as errors",
    )

    args = parser.parse_args()

    print(f"Validating: {args.config}")
    print("-" * 60)

    config = load_config(args.config)
    if config is None:
        sys.exit(1)

    validator = ConfigValidator(config)
    valid = validator.validate()

    # Print errors
    if validator.errors:
        print("\n❌ ERRORS:")
        for error in validator.errors:
            print(f"  • {error}")

    # Print warnings
    if validator.warnings:
        print("\n⚠️  WARNINGS:")
        for warning in validator.warnings:
            print(f"  • {warning}")

    # Print summary
    print("\n" + "=" * 60)
    if valid and not validator.warnings:
        print("✅ Configuration is valid!")
        sys.exit(0)
    elif valid and validator.warnings:
        if args.strict:
            print(
                f"❌ Configuration has {len(validator.warnings)} warnings (--strict mode)"
            )
            sys.exit(1)
        else:
            print(
                f"✅ Configuration is valid (with {len(validator.warnings)} warnings)"
            )
            sys.exit(0)
    else:
        print(f"❌ Configuration is invalid ({len(validator.errors)} errors)")
        sys.exit(1)


if __name__ == "__main__":
    main()
