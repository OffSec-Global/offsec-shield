import pytest
from guardian.detectors.brute_force import BruteForceDetector
from guardian.detectors.scanner import ScannerDetector


@pytest.mark.asyncio
async def test_brute_force_detector():
    detector = BruteForceDetector()
    
    # Multiple failed attempts
    log_lines = [
        "sshd[1234]: Failed password for invalid user admin from 192.168.1.100",
        "sshd[1235]: Failed password for invalid user admin from 192.168.1.100",
        "sshd[1236]: Failed password for invalid user admin from 192.168.1.100",
        "sshd[1237]: Failed password for invalid user admin from 192.168.1.100",
        "sshd[1238]: Failed password for invalid user admin from 192.168.1.100",
    ]
    
    events = []
    for log_line in log_lines:
        result = await detector.detect(log_line)
        events.extend(result)
    
    assert len(events) > 0
    assert events[0].event_type == "brute_force"
    assert events[0].severity == "high"


@pytest.mark.asyncio
async def test_scanner_detector():
    detector = ScannerDetector()
    
    log_line = "firewall: port scan detected from 192.168.1.1 nmap scan"
    events = await detector.detect(log_line)
    
    assert len(events) == 1
    assert events[0].event_type == "scanner"
