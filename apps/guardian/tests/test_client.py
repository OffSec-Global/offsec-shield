import pytest
from guardian.client import PortalClient


@pytest.mark.asyncio
async def test_client_uses_capability_token():
    client = PortalClient()
    try:
        token = client.issuer.token()
        assert token and isinstance(token, str)
    finally:
        await client.close()
