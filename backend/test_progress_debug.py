#!/usr/bin/env python3
"""
Debug script to test the background job progress functionality.
"""

import asyncio
import sys
from services.nb2cmk_database_service import nb2cmk_db_service, JobStatus
from services.nb2cmk_background_service import nb2cmk_background_service


async def test_job_progress():
    """Test the job progress functionality."""
    
    print("🔍 Testing Background Job Progress")
    print("=" * 50)
    
    try:
        # Test 1: Start a job
        print("\n1. Starting background job...")
        job_response = await nb2cmk_background_service.start_devices_diff_job("test-user")
        print(f"   Job started: {job_response.job_id}")
        print(f"   Status: {job_response.status}")
        
        job_id = job_response.job_id
        
        # Test 2: Immediately check progress (should show 0 devices initially)
        print("\n2. Checking initial progress...")
        progress = await nb2cmk_background_service.get_job_progress(job_id)
        print(f"   Progress: {progress.processed_devices}/{progress.total_devices} devices")
        print(f"   Status: {progress.status}")
        print(f"   Message: {progress.progress_message}")
        
        # Test 3: Monitor progress for a few iterations
        print("\n3. Monitoring progress...")
        for i in range(10):
            await asyncio.sleep(2)
            progress = await nb2cmk_background_service.get_job_progress(job_id)
            print(f"   Iteration {i+1}: {progress.processed_devices}/{progress.total_devices} devices - {progress.status}")
            print(f"   Message: {progress.progress_message}")
            
            if progress.status in [JobStatus.COMPLETED, JobStatus.FAILED, JobStatus.CANCELLED]:
                print(f"   Job finished with status: {progress.status}")
                break
        
        # Test 4: Final progress check
        final_progress = await nb2cmk_background_service.get_job_progress(job_id)
        print(f"\n4. Final progress:")
        print(f"   Status: {final_progress.status}")
        print(f"   Total processed: {final_progress.processed_devices}/{final_progress.total_devices}")
        print(f"   Final message: {final_progress.progress_message}")
        
        # Test 5: Check if we can get results (if completed)
        if final_progress.status == JobStatus.COMPLETED:
            print("\n5. Getting job results...")
            try:
                results = await nb2cmk_background_service.get_job_results(job_id)
                print(f"   Retrieved {results.total} device results")
                print(f"   Job status in results: {results.status}")
            except Exception as e:
                print(f"   Error getting results: {e}")
        
        print("\n✅ Progress test completed!")
        
    except Exception as e:
        print(f"\n❌ Test failed: {e}")
        import traceback
        traceback.print_exc()


async def test_database_directly():
    """Test the database operations directly."""
    
    print("\n" + "=" * 50)
    print("🗄️  Testing Database Operations")
    print("=" * 50)
    
    try:
        # Create a job
        job_id = nb2cmk_db_service.create_job("test-direct")
        print(f"Created job: {job_id}")
        
        # Test progress updates
        nb2cmk_db_service.update_job_progress(job_id, 0, 5, "Starting test...")
        print("Updated progress: 0/5")
        
        nb2cmk_db_service.update_job_progress(job_id, 3, 5, "Processing devices...")
        print("Updated progress: 3/5")
        
        nb2cmk_db_service.update_job_progress(job_id, 5, 5, "Completed!")
        print("Updated progress: 5/5")
        
        # Get job info
        job = nb2cmk_db_service.get_job(job_id)
        if job:
            print(f"Job status: {job.status}")
            print(f"Progress: {job.processed_devices}/{job.total_devices}")
            print(f"Message: {job.progress_message}")
        
        print("✅ Database test completed!")
        
    except Exception as e:
        print(f"❌ Database test failed: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    try:
        # First test database operations
        asyncio.run(test_database_directly())
        
        # Then test the full background job system
        asyncio.run(test_job_progress())
        
    except KeyboardInterrupt:
        print("\n\n⏹️  Test interrupted by user")
    except Exception as e:
        print(f"\n❌ Test suite failed: {e}")
        sys.exit(1)