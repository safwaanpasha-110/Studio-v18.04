import os
import requests
import pandas as pd
from pathlib import Path
import time
from typing import Dict, List, Optional, Tuple
import json
from concurrent.futures import ThreadPoolExecutor, as_completed
import threading
import argparse

# Configuration
API_BASE_URL = "http://172.203.130.108"
AUTH_TOKEN = "c9716faac11558fb214a6b45853a51732621cbb457865bc4445e6a53e5a91a95"
HEADERS = {
    'Accept': 'application/json',
    'Authorization': f'Token {AUTH_TOKEN}'
}

# Configuration
MAX_WORKERS = 10  # Number of concurrent threads
SAVE_INTERVAL = 100  # Save every 100 comparisons

# Thread-safe locks and counters
progress_lock = threading.Lock()
results_lock = threading.Lock()
processed_count = 0


def detect_face(image_path: str) -> Optional[str]:
    """Upload image for face detection and get detection ID."""
    url = f"{API_BASE_URL}/detect"
    
    try:
        with open(image_path, 'rb') as image_file:
            files = {
                'photo': (os.path.basename(image_path), image_file, 'image/jpeg')
            }
            data = {
                'attributes': '{"face": {"age": false, "beard": false}}'
            }
            
            response = requests.post(url, headers=HEADERS, files=files, data=data, timeout=30)
            response.raise_for_status()
            
            result = response.json()
            
            if 'objects' in result and 'face' in result['objects'] and len(result['objects']['face']) > 0:
                detection_id = result['objects']['face'][0].get('id')
                return detection_id
            else:
                return None
                
    except Exception as e:
        print(f"Error detecting face in {os.path.basename(image_path)}: {e}")
        return None


def compare_faces_1to1(detection_id_a: str, detection_id_b: str) -> Optional[float]:
    """
    Compare two detection IDs using 1:1 comparison.
    
    This uses the /verify endpoint if available, otherwise falls back to
    searching one detection against the other.
    
    Returns:
        Confidence score (0-100) or None if comparison failed
    """
    # Try verify endpoint first (if your API supports it)
    url = f"{API_BASE_URL}/verify"
    
    try:
        payload = {
            'detection1': detection_id_a,
            'detection2': detection_id_b
        }
        
        response = requests.post(url, headers=HEADERS, json=payload, timeout=30)
        
        if response.status_code == 200:
            result = response.json()
            confidence = result.get('confidence', result.get('similarity', 0))
            return confidence * 100 if confidence <= 1 else confidence
        else:
            # Fallback: use 1:N search approach
            return compare_via_search(detection_id_a, detection_id_b)
            
    except Exception as e:
        # Fallback to search method
        return compare_via_search(detection_id_a, detection_id_b)


def compare_via_search(detection_id_a: str, detection_id_b: str) -> Optional[float]:
    """
    Fallback comparison using 1:N search.
    
    Create a temporary card for detection_b and search with detection_a.
    """
    # Note: This is a simplified approach. In production, you might want to
    # create temporary cards or use a different strategy based on your API capabilities.
    
    # For now, we'll use the search endpoint directly with detection IDs
    url = f"{API_BASE_URL}/search"
    
    try:
        payload = {
            'detection_id': detection_id_a,
            'candidate_detections': [detection_id_b]
        }
        
        response = requests.post(url, headers=HEADERS, json=payload, timeout=30)
        response.raise_for_status()
        
        result = response.json()
        
        if 'results' in result and len(result['results']) > 0:
            confidence = result['results'][0].get('confidence', 0)
            return confidence * 100 if confidence <= 1 else confidence
        else:
            return 0.0
            
    except Exception as e:
        print(f"Error comparing faces: {e}")
        return None


def extract_source_id(filename: str) -> str:
    """Extract source ID from filename (without extension)."""
    return os.path.splitext(filename)[0]


def load_and_detect_batch(folder_path: str, batch_name: str) -> List[Tuple[str, str, str]]:
    """
    Load all images from a folder and detect faces.
    
    Args:
        folder_path: Path to folder containing images
        batch_name: Name for this batch (e.g., "Probe" or "Target")
        
    Returns:
        List of tuples: (filename, source_id, detection_id)
    """
    print(f"\n{'='*70}")
    print(f"Loading and detecting faces from {batch_name} folder")
    print(f"{'='*70}")
    
    if not os.path.exists(folder_path):
        print(f"Error: Folder not found: {folder_path}")
        return []
    
    # Get all image files
    image_extensions = {'.jpg', '.jpeg', '.png', '.bmp', '.gif'}
    image_files = [f for f in os.listdir(folder_path) 
                   if os.path.splitext(f.lower())[1] in image_extensions]
    
    total_images = len(image_files)
    print(f"Found {total_images} images in {batch_name} folder\n")
    
    detections = []
    failed_count = 0
    
    # Process images with threading
    def detect_single(idx_file):
        idx, image_file = idx_file
        image_path = os.path.join(folder_path, image_file)
        source_id = extract_source_id(image_file)
        
        with progress_lock:
            print(f"[{idx}/{total_images}] Detecting: {image_file}")
        
        detection_id = detect_face(image_path)
        
        if detection_id:
            with progress_lock:
                print(f"  ✓ Face detected: {detection_id[:16]}...")
            return (image_file, source_id, detection_id)
        else:
            with progress_lock:
                print(f"  ✗ No face detected")
            return None
    
    start_time = time.time()
    
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        futures = [executor.submit(detect_single, (idx + 1, img)) 
                   for idx, img in enumerate(image_files)]
        
        for future in as_completed(futures):
            result = future.result()
            if result:
                detections.append(result)
            else:
                failed_count += 1
    
    elapsed = time.time() - start_time
    success_count = len(detections)
    
    print(f"\n{batch_name} Detection Summary:")
    print(f"  ✓ Successful: {success_count}")
    print(f"  ✗ Failed: {failed_count}")
    print(f"  Time: {elapsed:.1f}s ({elapsed/total_images:.2f}s per image)")
    
    return detections


def process_nn_comparison(
    a_detections: List[Tuple[str, str, str]],
    b_detections: List[Tuple[str, str, str]],
    output_excel: str
) -> List[Dict]:
    """
    Perform N:N comparison between two sets of detections.
    
    Args:
        a_detections: List of (filename, source_id, detection_id) for set A
        b_detections: List of (filename, source_id, detection_id) for set B
        output_excel: Path to save results
        
    Returns:
        List of comparison results
    """
    print(f"\n{'='*70}")
    print(f"Starting N:N Face Comparison")
    print(f"{'='*70}")
    
    total_comparisons = len(a_detections) * len(b_detections)
    print(f"Probe images (A): {len(a_detections)}")
    print(f"Target images (B): {len(b_detections)}")
    print(f"Total comparisons: {total_comparisons:,}")
    print(f"Using {MAX_WORKERS} concurrent workers\n")
    
    all_results = []
    comparison_count = 0
    start_time = time.time()
    
    # Create comparison tasks
    comparison_tasks = []
    for idx_a, (file_a, id_a, det_a) in enumerate(a_detections, 1):
        for idx_b, (file_b, id_b, det_b) in enumerate(b_detections, 1):
            comparison_tasks.append((idx_a, idx_b, file_a, id_a, det_a, file_b, id_b, det_b))
    
    def compare_pair(task):
        """Compare a single pair of faces."""
        idx_a, idx_b, file_a, id_a, det_a, file_b, id_b, det_b = task
        
        comparison_num = (idx_a - 1) * len(b_detections) + idx_b
        
        with progress_lock:
            print(f"[{comparison_num}/{total_comparisons}] Comparing: {id_a} vs {id_b}")
        
        # Perform comparison
        score = compare_faces_1to1(det_a, det_b)
        
        if score is not None:
            with progress_lock:
                print(f"  Score: {score:.2f}%")
            
            return {
                'Probe Image': id_a,
                'Probe File': file_a,
                'Target Image': id_b,
                'Target File': file_b,
                'Match Score': f"{score:.2f}",
                'Match Status': 'Match' if score >= 70 else 'No Match',
                'Confidence Level': 'High' if score >= 90 else ('Medium' if score >= 70 else 'Low'),
                'Remarks': 'Strong match' if score >= 90 else ('Possible match' if score >= 70 else '')
            }
        else:
            with progress_lock:
                print(f"  ✗ Comparison failed")
            
            return {
                'Probe Image': id_a,
                'Probe File': file_a,
                'Target Image': id_b,
                'Target File': file_b,
                'Match Score': 'N/A',
                'Match Status': 'Error',
                'Confidence Level': 'N/A',
                'Remarks': 'Comparison failed'
            }
    
    # Process comparisons concurrently
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        futures = [executor.submit(compare_pair, task) for task in comparison_tasks]
        
        for future in as_completed(futures):
            try:
                result = future.result()
                
                with results_lock:
                    all_results.append(result)
                    comparison_count += 1
                    
                    # Save progress checkpoint
                    if comparison_count % SAVE_INTERVAL == 0:
                        elapsed = time.time() - start_time
                        rate = comparison_count / elapsed
                        eta = (total_comparisons - comparison_count) / rate if rate > 0 else 0
                        
                        print(f"\n--- Checkpoint: {comparison_count}/{total_comparisons} ---")
                        print(f"Rate: {rate:.2f} comp/s | ETA: {eta/60:.1f} min")
                        save_to_excel(all_results, output_excel)
                        
            except Exception as e:
                print(f"Error processing comparison: {e}")
    
    # Final stats
    elapsed = time.time() - start_time
    rate = comparison_count / elapsed if elapsed > 0 else 0
    
    print(f"\n{'='*70}")
    print(f"N:N Comparison Complete!")
    print(f"{'='*70}")
    print(f"Total comparisons: {comparison_count}")
    print(f"Time: {elapsed:.1f}s ({elapsed/60:.1f} min)")
    print(f"Average rate: {rate:.2f} comparisons/second")
    print(f"{'='*70}\n")
    
    return all_results


def save_to_excel(results: List[Dict], output_path: str):
    """Save N:N comparison results to Excel file."""
    df = pd.DataFrame(results)
    
    # Sort by probe image and match score
    if 'Match Score' in df.columns:
        df['_score_numeric'] = pd.to_numeric(df['Match Score'], errors='coerce')
        df = df.sort_values(['Probe Image', '_score_numeric'], ascending=[True, False])
        df = df.drop('_score_numeric', axis=1)
    
    with pd.ExcelWriter(output_path, engine='openpyxl') as writer:
        df.to_excel(writer, sheet_name='N:N Results', index=False)
        
        workbook = writer.book
        worksheet = writer.sheets['N:N Results']
        
        # Auto-adjust column widths
        for column in worksheet.columns:
            max_length = 0
            column_letter = column[0].column_letter
            for cell in column:
                try:
                    if len(str(cell.value)) > max_length:
                        max_length = len(str(cell.value))
                except:
                    pass
            adjusted_width = min(max_length + 2, 50)
            worksheet.column_dimensions[column_letter].width = adjusted_width
    
    print(f"✓ Results saved to: {output_path}")


def run_nn_search(a_folder: str, b_folder: str, output_excel: str):
    """
    Main N:N search orchestrator.
    
    Args:
        a_folder: Path to folder containing probe images (set A)
        b_folder: Path to folder containing target images (set B)
        output_excel: Path to save Excel results
    """
    print("="*70)
    print("N:N Face Search System")
    print("="*70)
    print(f"Probe folder (A): {a_folder}")
    print(f"Target folder (B): {b_folder}")
    print(f"Output file: {output_excel}")
    
    # Step 1: Detect faces in set A
    a_detections = load_and_detect_batch(a_folder, "Probe (A)")
    
    if not a_detections:
        print("Error: No faces detected in probe folder (A)")
        return
    
    # Step 2: Detect faces in set B
    b_detections = load_and_detect_batch(b_folder, "Target (B)")
    
    if not b_detections:
        print("Error: No faces detected in target folder (B)")
        return
    
    # Step 3: Perform N:N comparisons
    results = process_nn_comparison(a_detections, b_detections, output_excel)
    
    # Step 4: Save final results
    if results:
        save_to_excel(results, output_excel)
        
        # Print summary statistics
        df = pd.DataFrame(results)
        matches = len(df[df['Match Status'] == 'Match'])
        no_matches = len(df[df['Match Status'] == 'No Match'])
        errors = len(df[df['Match Status'] == 'Error'])
        
        print(f"\n{'='*70}")
        print(f"Final Summary")
        print(f"{'='*70}")
        print(f"Matches found: {matches}")
        print(f"No matches: {no_matches}")
        print(f"Errors: {errors}")
        print(f"Total: {len(results)}")
        print(f"{'='*70}")


def main():
    """Main execution function with argument parsing."""
    parser = argparse.ArgumentParser(
        description='N:N Face Search System - Compare two sets of face images',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python nn_search.py --A ./probe_faces --B ./target_faces --out results.xlsx
  python nn_search.py --A /path/to/setA --B /path/to/setB --out comparison.xlsx
        """
    )
    
    parser.add_argument(
        '--A', '--probe',
        dest='a_folder',
        required=True,
        help='Path to probe images folder (set A)'
    )
    
    parser.add_argument(
        '--B', '--target',
        dest='b_folder',
        required=True,
        help='Path to target images folder (set B)'
    )
    
    parser.add_argument(
        '--out', '--output',
        dest='output_excel',
        required=True,
        help='Path to output Excel file'
    )
    
    parser.add_argument(
        '--workers',
        type=int,
        default=10,
        help='Number of concurrent workers (default: 10)'
    )
    
    parser.add_argument(
        '--save-interval',
        type=int,
        default=100,
        help='Save progress every N comparisons (default: 100)'
    )
    
    args = parser.parse_args()
    
    # Update global configuration
    global MAX_WORKERS, SAVE_INTERVAL
    MAX_WORKERS = args.workers
    SAVE_INTERVAL = args.save_interval
    
    # Run N:N search
    try:
        run_nn_search(args.a_folder, args.b_folder, args.output_excel)
        print("\n✓ N:N search completed successfully!")
    except KeyboardInterrupt:
        print("\n\nProcess interrupted by user.")
    except Exception as e:
        print(f"\n\nFatal error: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()
