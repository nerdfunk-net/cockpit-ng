#!/usr/bin/env python3
"""
Test script for NB2CMK background job functionality.
This demonstrates the new background job API endpoints.
"""

import asyncio
import json
from services.nb2cmk_database_service import nb2cmk_db_service, JobStatus
from services.nb2cmk_background_service import nb2cmk_background_service


async def test_background_jobs():
    """Test the complete background job workflow."""
    
    print("🚀 Testing NB2CMK Background Job System")
    print("=" * 50)
    
    # Test 1: Start a background job
    print("\n1. Starting background job...")
    job_response = await nb2cmk_background_service.start_devices_diff_job("test-user")
    print(f"   Job ID: {job_response.job_id}")
    print(f"   Status: {job_response.status}")
    print(f"   Message: {job_response.message}")
    
    job_id = job_response.job_id
    
    # Test 2: Check that we can't start another job while one is running
    print("\n2. Attempting to start second job (should be prevented)...")
    second_job_response = await nb2cmk_background_service.start_devices_diff_job("test-user")
    print(f"   Response: {second_job_response.message}")
    
    # Test 3: Monitor progress for a few seconds
    print("\n3. Monitoring job progress...")
    for i in range(5):
        progress = await nb2cmk_background_service.get_job_progress(job_id)
        print(f"   Progress: {progress.processed_devices}/{progress.total_devices} devices")
        print(f"   Status: {progress.status}")
        print(f"   Message: {progress.progress_message}")
        
        if progress.status in [JobStatus.COMPLETED, JobStatus.FAILED]:
            break
            
        await asyncio.sleep(2)
    
    # Test 4: Get final results (if completed)
    final_progress = await nb2cmk_background_service.get_job_progress(job_id)
    if final_progress.status == JobStatus.COMPLETED:
        print("\n4. Getting job results...")
        results = await nb2cmk_background_service.get_job_results(job_id)
        print(f"   Job ID: {results.job_id}")
        print(f"   Status: {results.status}")
        print(f"   Total devices: {results.total}")
        print(f"   Message: {results.message}")
        print(f"   Sample results (first 3):")
        for device in results.devices[:3]:
            print(f"     - {device['name']}: {device['checkmk_status']}")
    else:
        print(f"\n4. Job not completed yet (status: {final_progress.status})")
        print("   You can cancel the job or wait for it to complete")
    
    print("\n🎉 Background job test completed!")


async def demo_api_workflow():
    """Demonstrate the API workflow that the frontend would use."""
    
    print("\n" + "=" * 50)
    print("🌐 API Workflow Demo")
    print("=" * 50)
    
    print("\nThis demonstrates the three buttons in the frontend:")
    
    # Button 1: Start Check
    print("\n1. [Start Check Button] - POST /api/nb2cmk/start-diff-job")
    job_response = await nb2cmk_background_service.start_devices_diff_job("frontend-user")
    print(f"   → Returns: {job_response.job_id} (status: {job_response.status})")
    
    job_id = job_response.job_id
    
    # Button 2: Get Progress (would be called periodically)
    print("\n2. [Get Progress Button] - GET /api/nb2cmk/job/{job_id}/progress")
    for i in range(3):
        progress = await nb2cmk_background_service.get_job_progress(job_id)
        print(f"   → Progress: {progress.processed_devices}/{progress.total_devices} - {progress.progress_message}")
        
        if progress.status in [JobStatus.COMPLETED, JobStatus.FAILED]:
            break
        await asyncio.sleep(1)
    
    # Button 3: View Diff (after job completes)
    final_progress = await nb2cmk_background_service.get_job_progress(job_id)
    if final_progress.status == JobStatus.COMPLETED:
        print("\n3. [View Diff Button] - GET /api/nb2cmk/job/{job_id}/results")
        results = await nb2cmk_background_service.get_job_results(job_id)
        print(f"   → Returns {results.total} device comparisons")
        print(f"   → Same format as existing /get_diff endpoint")
    else:
        print("\n3. [View Diff Button] - Not available yet (job still running)")


if __name__ == "__main__":
    try:
        asyncio.run(test_background_jobs())
        asyncio.run(demo_api_workflow())
    except KeyboardInterrupt:
        print("\n\n⏹️  Test interrupted by user")
    except Exception as e:
        print(f"\n❌ Test failed: {e}")
        import traceback
        traceback.print_exc()