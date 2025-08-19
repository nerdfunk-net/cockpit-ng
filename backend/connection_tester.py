"""
Connection testing utilities for settings validation
Tests Nautobot and Git connections with user-provided settings
"""

import asyncio
import logging
import requests
import git
import tempfile
import shutil
import os
from typing import Dict, Any, Tuple
from urllib.parse import urlparse
from concurrent.futures import ThreadPoolExecutor

logger = logging.getLogger(__name__)

class ConnectionTester:
    """Tests connections for various services"""

    @staticmethod
    async def test_nautobot_connection(settings: Dict[str, Any]) -> Tuple[bool, str]:
        """
        Test connection to Nautobot instance

        Args:
            settings: Dict with url, token, timeout, verify_ssl

        Returns:
            Tuple of (success: bool, message: str)
        """
        url = settings.get('url', '').strip()
        token = settings.get('token', '').strip()
        timeout = settings.get('timeout', 30)
        verify_ssl = settings.get('verify_ssl', True)

        if not url or not token:
            return False, "URL and token are required"

        try:
            # Parse URL to ensure it's valid
            parsed = urlparse(url)
            if not parsed.scheme or not parsed.netloc:
                return False, "Invalid URL format"

            # Prepare headers
            headers = {
                'Authorization': f'Token {token}',
                'Content-Type': 'application/json',
                'User-Agent': 'Cockpit-Settings-Test/1.0'
            }

            # Test multiple potential API endpoints to find the right one
            potential_endpoints = [
                f"{url.rstrip('/')}/api/",
                f"{url.rstrip('/')}/graphql/",
                f"{url.rstrip('/')}/",  # Try base URL
            ]

            # Use ThreadPoolExecutor to run requests in async context
            def make_request(url, headers, timeout, verify_ssl):
                return requests.get(url, headers=headers, timeout=timeout, verify=verify_ssl)

            executor = ThreadPoolExecutor(max_workers=1)

            # First, let's test the base URL to see if it's a valid Nautobot instance
            try:
                loop = asyncio.get_event_loop()
                response = await loop.run_in_executor(
                    executor, make_request, f"{url.rstrip('/')}/", headers, timeout, verify_ssl
                )

                # Check if this looks like a Nautobot instance  
                if response.status_code == 200:
                    response_text = response.text.lower()
                    if 'nautobot' in response_text or 'netbox' in response_text:
                        # This looks like a Nautobot/NetBox instance
                        pass
                    else:
                        return False, f"URL appears to be accessible but doesn't look like a Nautobot instance. Please verify the URL points to your Nautobot installation."
                elif response.status_code == 404:
                    return False, f"Base URL not found. Please verify the Nautobot URL is correct (e.g., http://nautobot.example.com or http://localhost:8080)."
                elif response.status_code in [401, 403]:
                    # Auth required even for base page, try API directly
                    pass
                else:
                    return False, f"Base URL returned HTTP {response.status_code}. Please verify the Nautobot URL."
            except Exception as e:
                return False, f"Cannot reach base URL: {str(e)}"

            # Now test API endpoints
            for api_endpoint in potential_endpoints:
                try:
                    response = await loop.run_in_executor(
                        executor, make_request, api_endpoint, headers, timeout, verify_ssl
                    )

                    if response.status_code == 200:
                        # Found a working API endpoint, now test device access
                        devices_url = f"{url.rstrip('/')}/api/dcim/devices/?limit=1"
                        devices_response = await loop.run_in_executor(
                            executor, make_request, devices_url, headers, timeout, verify_ssl
                        )

                        if devices_response.status_code == 200:
                            return True, f"Connection successful! Nautobot REST API is accessible with device permissions. (Using endpoint: {api_endpoint})"
                        elif devices_response.status_code == 403:
                            # Try a less privileged endpoint
                            status_url = f"{url.rstrip('/')}/api/status/"
                            status_response = await loop.run_in_executor(
                                executor, make_request, status_url, headers, timeout, verify_ssl
                            )

                            if status_response.status_code == 200:
                                return True, f"Connection successful! Nautobot API is accessible (limited permissions detected). (Using endpoint: {api_endpoint})"
                            else:
                                return False, "Access forbidden. Your token may not have sufficient permissions. Please ensure your token has at least 'read' permissions for basic API access."
                        elif devices_response.status_code == 401:
                            return False, "Authentication failed. Please check your API token."
                        elif devices_response.status_code == 404:
                            # API root works but devices endpoint doesn't - might be different Nautobot version
                            return True, f"Connection successful! API is accessible but device endpoint structure may be different. (Using endpoint: {api_endpoint})"
                        else:
                            error_text = devices_response.text[:200] if devices_response.text else "No error details"
                            return False, f"Device API test failed - HTTP {devices_response.status_code}: {error_text}"
                    elif response.status_code == 401:
                        return False, "Authentication failed. Please check your API token."
                    elif response.status_code == 403:
                        return False, "Access forbidden. Your token may not have sufficient permissions. Please ensure your token has at least 'read' permissions."
                    # If we get 404, try the next endpoint
                except Exception as e:
                    continue  # Try next endpoint

            # None of the API endpoints worked
            return False, f"No accessible API endpoints found. Tried: {', '.join(potential_endpoints)}. Please verify this is a Nautobot instance and the URL is correct."

        except requests.exceptions.ConnectionError as e:
            return False, f"Connection failed: {str(e)}"
        except requests.exceptions.Timeout:
            return False, f"Connection timed out after {timeout} seconds"
        except Exception as e:
            logger.error(f"Nautobot connection test error: {e}")
            return False, f"Unexpected error: {str(e)}"

    @staticmethod
    async def test_git_connection(settings: Dict[str, Any]) -> Tuple[bool, str]:
        """
        Test connection to Git repository

        Args:
            settings: Dict with repo_url, branch, username, token, verify_ssl

        Returns:
            Tuple of (success: bool, message: str)
        """
        repo_url = settings.get('repo_url', '').strip()
        branch = settings.get('branch', 'main').strip()
        username = settings.get('username', '').strip()
        token = settings.get('token', '').strip()
        verify_ssl = settings.get('verify_ssl', True)

        if not repo_url:
            return False, "Repository URL is required"

        # Create temporary directory for clone test
        temp_dir = None
        try:
            temp_dir = tempfile.mkdtemp(prefix='cockpit_git_test_')

            # Prepare repository URL with authentication if provided
            test_url = repo_url
            if username and token:
                # Parse URL to inject credentials
                parsed = urlparse(repo_url)
                if parsed.scheme in ['http', 'https']:
                    # Reconstruct URL with credentials
                    test_url = f"{parsed.scheme}://{username}:{token}@{parsed.netloc}{parsed.path}"

            # Test 1: Check if repository is accessible (ls-remote)
            try:
                # Use git ls-remote to test connectivity without full clone
                import subprocess

                # Prepare environment with SSL settings
                env = os.environ.copy()
                if not verify_ssl:
                    env['GIT_SSL_NO_VERIFY'] = '1'
                    logger.warning("Git SSL verification disabled for connection test")

                result = subprocess.run([
                    'git', 'ls-remote', '--heads', test_url
                ], capture_output=True, text=True, timeout=30, env=env)

                if result.returncode != 0:
                    error_msg = result.stderr.strip()
                    if 'authentication failed' in error_msg.lower():
                        return False, "Authentication failed. Please check your username and token."
                    elif 'not found' in error_msg.lower():
                        return False, "Repository not found. Please check the URL."
                    elif 'permission denied' in error_msg.lower():
                        return False, "Permission denied. Please check your access rights."
                    else:
                        return False, f"Git error: {error_msg}"

                # Parse ls-remote output to check if branch exists
                if branch and branch != 'main':
                    branches = result.stdout
                    if f'refs/heads/{branch}' not in branches:
                        available_branches = []
                        for line in branches.split('\n'):
                            if 'refs/heads/' in line:
                                branch_name = line.split('refs/heads/')[-1].strip()
                                if branch_name:
                                    available_branches.append(branch_name)

                        if available_branches:
                            return False, f"Branch '{branch}' not found. Available branches: {', '.join(available_branches[:5])}"
                        else:
                            return False, f"Branch '{branch}' not found and no branches detected."

                return True, f"Connection successful! Repository is accessible and branch '{branch}' exists."

            except subprocess.TimeoutExpired:
                return False, "Git connection timed out after 30 seconds"
            except subprocess.CalledProcessError as e:
                return False, f"Git command failed: {e}"
            except FileNotFoundError:
                return False, "Git command not found. Please ensure Git is installed on the server."

        except Exception as e:
            logger.error(f"Git connection test error: {e}")
            return False, f"Unexpected error: {str(e)}"

        finally:
            # Clean up temporary directory
            if temp_dir and os.path.exists(temp_dir):
                try:
                    shutil.rmtree(temp_dir)
                except Exception as e:
                    logger.warning(f"Failed to clean up temp directory {temp_dir}: {e}")

    @staticmethod
    async def test_all_connections(nautobot_settings: Dict[str, Any], git_settings: Dict[str, Any]) -> Dict[str, Any]:
        """
        Test all connections and return comprehensive results

        Returns:
            Dict with test results for each service
        """
        results = {
            'nautobot': {'success': False, 'message': ''},
            'git': {'success': False, 'message': ''},
            'overall_success': False
        }

        # Test Nautobot connection
        try:
            nautobot_success, nautobot_msg = await ConnectionTester.test_nautobot_connection(nautobot_settings)
            results['nautobot'] = {
                'success': nautobot_success,
                'message': nautobot_msg
            }
        except Exception as e:
            results['nautobot'] = {
                'success': False,
                'message': f"Test failed: {str(e)}"
            }

        # Test Git connection
        try:
            git_success, git_msg = await ConnectionTester.test_git_connection(git_settings)
            results['git'] = {
                'success': git_success,
                'message': git_msg
            }
        except Exception as e:
            results['git'] = {
                'success': False,
                'message': f"Test failed: {str(e)}"
            }

        # Overall success if both tests pass
        results['overall_success'] = results['nautobot']['success'] and results['git']['success']

        return results

# Global connection tester instance
connection_tester = ConnectionTester()
