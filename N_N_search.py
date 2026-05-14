"""
N:N Facial Recognition Search Script
Multi-threaded implementation for bulk face matching

This script:
1. Detects faces in probe images using POST /detect
2. Searches each detection against the database using GET /cards/humans/?looks_like=detection:<id>&threshold=<value>
3. Fetches face objects for matched cards using GET /objects/faces/?card=<id>
4. Generates comprehensive Excel report with all matches
"""

import os
import requests
import pandas as pd
from pathlib import Path
import time
from typing import Dict, List, Optional, Tuple
import json
from concurrent.futures import ThreadPoolExecutor, as_completed
import threading

# Configuration
API_BASE_URL = "http://172.203.130.108"
AUTH_TOKEN = "c9716faac11558fb214a6b45853a51732621cbb457865bc4445e6a53e5a91a95"
HEADERS = {
    'Accept': 'application/json',
    'Authorization': f'Token {AUTH_TOKEN}'
}

# Paths - Update these for your environment
IMAGE_FOLDER = r"C:\Users\Admin\Downloads\faces_folder\Photos"
OUTPUT_EXCEL = r"C:\Users\Admin\Downloads\faces_folder\NN_Search_Results.xlsx"

# Performance Configuration
MAX_WORKERS = 10  # Number of concurrent threads
SAVE_INTERVAL = 50  # Save progress every N images
THRESHOLD = 0.7  # Match threshold (0.0 to 1.0)
PAGE_SIZE = 100  # Number of results per search

# Thread-safe counters
progress_lock = threading.Lock()
results_lock = threading.Lock()

# Global watchlist cache
watchlist_map = {}


def fetch_watchlists() -> Dict[int, str]:
    """
    Fetch all watchlists from the system.
    
    Returns:
        Dictionary mapping watchlist ID to name
    """
    url = f"{API_BASE_URL}/permissions/watch-lists/"
    
    try:
        response = requests.get(url, headers=HEADERS, timeout=30)
        response.raise_for_status()
        
        result = response.json()
        
        watchlist_dict = {}
        if 'results' in result and len(result['results']) > 0:
            for wl in result['results']:
                watchlist_dict[wl.get('id')] = wl.get('name', f"Watchlist {wl.get('id')}")
        
        return watchlist_dict
            
    except Exception as e:
        print(f"Error fetching watchlists: {e}")
        return {}


def detect_face(image_path: str) -> Optional[str]:
    """
    Step 1: Upload image for face detection and get detection ID.
    
    Args:
        image_path: Path to the image file
        
    Returns:
        Detection ID string if face found, None otherwise
    """
    url = f"{API_BASE_URL}/detect"
    
    try:
        with open(image_path, 'rb') as image_file:
            files = {
                'photo': (os.path.basename(image_path), image_file, 'image/jpeg')
            }
            data = {
                'attributes': json.dumps({
                    "face": {
                        "age": False,
                        "beard": False,
                        "emotions": False,
                        "glasses": False,
                        "gender": False,
                        "medmask": False,
                        "headpose": False
                    }
                })
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


def search_matches(detection_id: str, threshold: float = THRESHOLD) -> List[Dict]:
    """
    Step 2: Search for matching faces using detection ID with threshold.
    
    Args:
        detection_id: The detection ID from step 1
        threshold: Confidence threshold (0.0 to 1.0)
        
    Returns:
        List of matching card dictionaries
    """
    url = f"{API_BASE_URL}/cards/humans/"
    params = {
        'looks_like': f'detection:{detection_id}',
        'threshold': threshold,
        'page_size': PAGE_SIZE
    }
    
    try:
        response = requests.get(url, headers=HEADERS, params=params, timeout=30)
        response.raise_for_status()
        
        result = response.json()
        
        matches = []
        if 'results' in result and len(result['results']) > 0:
            for match in result['results']:
                matches.append({
                    'id': match.get('id', ''),
                    'name': match.get('name', 'Unknown'),
                    'confidence': (match.get('looks_like_confidence', 0) * 100),
                    'created_date': match.get('created_date', ''),
                    'watch_lists': match.get('watch_lists', []),
                    'face_objects': match.get('face_objects', 0),
                    'meta': match.get('meta', {})
                })
        
        return matches
            
    except Exception as e:
        print(f"Error searching matches: {e}")
        return []


def get_face_objects(card_id: int) -> List[Dict]:
    """
    Step 3: Fetch face object images for a matched card.
    
    Args:
        card_id: The card ID from step 2
        
    Returns:
        List of face object dictionaries with thumbnails
    """
    url = f"{API_BASE_URL}/objects/faces/"
    params = {
        'card': card_id
    }
    
    try:
        response = requests.get(url, headers=HEADERS, params=params, timeout=30)
        response.raise_for_status()
        
        result = response.json()
        
        face_objects = []
        if 'results' in result and len(result['results']) > 0:
            for face in result['results']:
                face_objects.append({
                    'id': face.get('id', ''),
                    'thumbnail': face.get('thumbnail', ''),
                    'card': face.get('card', card_id)
                })
        
        return face_objects
            
    except Exception as e:
        print(f"Error fetching face objects for card {card_id}: {e}")
        return []


def extract_source_id(filename: str) -> str:
    """Extract source ID from filename (remove extension)."""
    return os.path.splitext(filename)[0]


def process_single_image(
    image_info: Tuple[int, str, str], 
    total_images: int, 
    already_processed: int
) -> List[Dict]:
    """
    Process a single image through the complete pipeline.
    
    This is the worker function that runs in multiple threads.
    
    Args:
        image_info: Tuple of (index, filename, filepath)
        total_images: Total number of images to process
        already_processed: Number of images already processed
        
    Returns:
        List of result dictionaries for this image
    """
    idx, image_file, image_path = image_info
    source_id = extract_source_id(image_file)
    actual_idx = already_processed + idx
    
    result_rows = []
    
    with progress_lock:
        print(f"[{actual_idx}/{total_images}] Processing: {image_file}")
    
    # Step 1: Detect face
    detection_id = detect_face(image_path)
    
    if detection_id is None:
        result_rows.append({
            'S.No': actual_idx,
            'Source ID': source_id,
            'Source File': image_file,
            'Detection Status': 'No Face Detected',
            'Match Found': 'No',
            'Matched Card ID': '',
            'Matched Name': '',
            'Confidence Score (%)': '',
            'Watch Lists': '',
            'Face Objects Count': '',
            'Card Created Date': '',
            'Meta Info': '',
            'Remarks': 'No face detected in image'
        })
        with progress_lock:
            print(f"  ✗ No face detected")
        return result_rows
    
    with progress_lock:
        print(f"  ✓ Face detected: {detection_id[:16]}...")
    
    # Step 2: Search for matches
    matches = search_matches(detection_id, THRESHOLD)
    
    if not matches:
        result_rows.append({
            'S.No': actual_idx,
            'Source ID': source_id,
            'Source File': image_file,
            'Detection Status': 'Face Detected',
            'Match Found': 'No',
            'Matched Card ID': '',
            'Matched Name': '',
            'Confidence Score (%)': '',
            'Watch Lists': '',
            'Face Objects Count': '',
            'Card Created Date': '',
            'Meta Info': '',
            'Remarks': f'No matches found above {THRESHOLD*100:.0f}% threshold'
        })
        with progress_lock:
            print(f"  ✗ No matches found above threshold")
        return result_rows
    
    with progress_lock:
        print(f"  ✓ Found {len(matches)} matches")
    
    # Step 3: Fetch face objects for each match
    for match_idx, match in enumerate(matches):
        card_id = match['id']
        face_objects = get_face_objects(card_id)
        
        # Format metadata
        meta_info = match.get('meta', {})
        meta_str = ', '.join([f"{k}: {v}" for k, v in meta_info.items() if v])
        
        # Get watchlist names
        watchlist_ids = match['watch_lists']
        watchlist_names = [watchlist_map.get(wl_id, f"Watchlist {wl_id}") for wl_id in watchlist_ids]
        watchlist_str = ', '.join(watchlist_names) if watchlist_names else ''
        
        # Create result row
        is_primary = (match_idx == 0)
        result_rows.append({
            'S.No': actual_idx if is_primary else '',
            'Source ID': source_id if is_primary else '',
            'Source File': image_file if is_primary else '',
            'Detection Status': 'Face Detected' if is_primary else '',
            'Match Found': 'Yes' if is_primary else '',
            'Matched Card ID': card_id,
            'Matched Name': match['name'],
            'Confidence Score (%)': f"{match['confidence']:.2f}",
            'Watchlist IDs': ', '.join(map(str, match['watch_lists'])),
            'Watchlist Names': watchlist_str,
            'Face Objects Count': len(face_objects),
            'Card Created Date': match['created_date'],
            'Meta Info': meta_str,
            'Remarks': 'Primary match' if is_primary else f'Alternative match #{match_idx}'
        })
        
        with progress_lock:
            if is_primary:
                print(f"    → Best match: {match['name']} ({match['confidence']:.1f}%)")
            else:
                print(f"    → Alt match: {match['name']} ({match['confidence']:.1f}%)")
    
    return result_rows


def save_to_excel(results: List[Dict], output_path: str):
    """Save results to formatted Excel file."""
    df = pd.DataFrame(results)
    
    with pd.ExcelWriter(output_path, engine='openpyxl') as writer:
        df.to_excel(writer, sheet_name='N:N Search Results', index=False)
        
        workbook = writer.book
        worksheet = writer.sheets['N:N Search Results']
        
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
    
    print(f"\n✓ Results saved to: {output_path}\n")


def process_images_concurrent(image_folder: str) -> List[Dict]:
    """Process all images concurrently with progress tracking."""
    global watchlist_map
    
    all_results = []
    processed_files = set()
    
    # Fetch watchlists first
    print("Fetching watchlists...")
    watchlist_map = fetch_watchlists()
    print(f"✓ Loaded {len(watchlist_map)} watchlists\n")
    
    # Check for existing results and resume if possible
    if os.path.exists(OUTPUT_EXCEL):
        try:
            existing_df = pd.read_excel(OUTPUT_EXCEL)
            all_results = existing_df.to_dict('records')
            processed_files = set(existing_df[existing_df['Source ID'].notna()]['Source ID'].astype(str))
            print(f"Resuming: Found {len(processed_files)} already processed images\n")
        except Exception as e:
            print(f"Could not load existing results: {e}")
            print("Starting fresh...\n")
    
    # Get all image files
    image_extensions = {'.jpg', '.jpeg', '.png', '.bmp', '.gif'}
    all_image_files = [f for f in os.listdir(image_folder) 
                       if os.path.splitext(f.lower())[1] in image_extensions]
    
    # Filter out already processed images
    image_files = [f for f in all_image_files 
                   if extract_source_id(f) not in processed_files]
    
    total_images = len(all_image_files)
    already_processed = len(all_image_files) - len(image_files)
    remaining = len(image_files)
    
    print("=" * 80)
    print("N:N Facial Recognition Search (Multi-threaded)")
    print("=" * 80)
    print(f"Image folder: {image_folder}")
    print(f"Output file: {OUTPUT_EXCEL}")
    print(f"Threshold: {THRESHOLD} ({THRESHOLD*100:.0f}%)")
    print(f"Max workers: {MAX_WORKERS}")
    print(f"Page size: {PAGE_SIZE}")
    print()
    
    if already_processed > 0:
        print(f"Already processed: {already_processed} images")
    print(f"Remaining to process: {remaining} images")
    print(f"Total images: {total_images}")
    print("=" * 80)
    print()
    
    if remaining == 0:
        print("✓ All images already processed!")
        return all_results
    
    # Prepare image tasks
    image_tasks = [(idx + 1, img, os.path.join(image_folder, img)) 
                   for idx, img in enumerate(image_files)]
    
    # Process images concurrently
    completed_count = 0
    start_time = time.time()
    
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        # Submit all tasks
        future_to_image = {
            executor.submit(process_single_image, task, total_images, already_processed): task 
            for task in image_tasks
        }
        
        # Process completed tasks
        for future in as_completed(future_to_image):
            try:
                result_rows = future.result()
                
                with results_lock:
                    all_results.extend(result_rows)
                    completed_count += 1
                    
                    # Save progress periodically
                    if completed_count % SAVE_INTERVAL == 0:
                        actual_count = already_processed + completed_count
                        elapsed = time.time() - start_time
                        rate = completed_count / elapsed if elapsed > 0 else 0
                        eta = (remaining - completed_count) / rate if rate > 0 else 0
                        
                        print(f"\n{'='*80}")
                        print(f"Progress Checkpoint: {actual_count}/{total_images} images")
                        print(f"{'='*80}")
                        print(f"Completed this session: {completed_count}/{remaining}")
                        print(f"Processing rate: {rate:.2f} images/second")
                        print(f"Estimated time remaining: {eta/60:.1f} minutes")
                        print(f"Saving checkpoint...")
                        save_to_excel(all_results, OUTPUT_EXCEL)
                        print(f"{'='*80}\n")
                        
            except Exception as e:
                print(f"Error processing image: {e}")
                import traceback
                traceback.print_exc()
    
    # Final statistics
    elapsed = time.time() - start_time
    rate = completed_count / elapsed if elapsed > 0 else 0
    
    print(f"\n{'='*80}")
    print(f"N:N Search Complete!")
    print(f"{'='*80}")
    print(f"Images processed this session: {completed_count}")
    print(f"Total time: {elapsed:.1f} seconds ({elapsed/60:.1f} minutes)")
    print(f"Average processing rate: {rate:.2f} images/second")
    print(f"Total results: {len(all_results)} rows")
    print(f"{'='*80}\n")
    
    return all_results


def main():
    """Main execution function."""
    if not os.path.exists(IMAGE_FOLDER):
        print(f"Error: Image folder not found: {IMAGE_FOLDER}")
        return
    
    # Process all images
    results = process_images_concurrent(IMAGE_FOLDER)
    
    # Save final results
    if results:
        save_to_excel(results, OUTPUT_EXCEL)
        print(f"✓ All results saved successfully!")
        print(f"✓ Total rows in Excel: {len(results)}")
    else:
        print("No results to save.")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\nProcess interrupted by user.")
        print("Progress has been saved. You can resume later.")
    except Exception as e:
        print(f"\n\nFatal error: {e}")
        import traceback
        traceback.print_exc()
