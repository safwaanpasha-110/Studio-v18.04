import os
import requests
import pandas as pd
from pathlib import Path
import time
from typing import Dict, List, Optional
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

# Image folder path
IMAGE_FOLDER = r"C:\Users\Admin\Downloads\faces_folder\Photos"
OUTPUT_EXCEL = r"C:\Users\Admin\Downloads\faces_folder\Result_excel.xlsx"

# Configuration
MAX_WORKERS = 10  # Number of concurrent threads
SAVE_INTERVAL = 50  # Save every 50 images

# Thread-safe counter and lock
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


def search_matches(detection_id: str) -> List[Dict]:
    """Search for matching faces using detection ID."""
    url = f"{API_BASE_URL}/cards/humans/"
    params = {
        'looks_like': f'detection:{detection_id}',
        'page_size': 100
    }
    
    try:
        response = requests.get(url, headers=HEADERS, params=params, timeout=30)
        response.raise_for_status()
        
        result = response.json()
        
        matches = []
        if 'results' in result and len(result['results']) > 0:
            for match in result['results']:
                matches.append({
                    'name': match.get('name', 'Unknown'),
                    'confidence': match.get('looks_like_confidence', 0) * 100,
                    'id': match.get('id', ''),
                    'created_date': match.get('created_date', ''),
                    'face_objects': match.get('face_objects', 0)
                })
        
        return matches
            
    except Exception as e:
        print(f"Error searching matches: {e}")
        return []


def extract_source_id(filename: str) -> str:
    """Extract source ID from filename."""
    return os.path.splitext(filename)[0]


def process_single_image(image_info: tuple, total_images: int, already_processed: int) -> List[Dict]:
    """
    Process a single image and return result rows.
    
    Args:
        image_info: Tuple of (index, filename, filepath)
        total_images: Total number of images
        already_processed: Number of already processed images
        
    Returns:
        List of result dictionaries for this image
    """
    global processed_count
    
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
            'Digitized (Yes/No)': 'No',
            'Match Found? (Yes/No)': 'No',
            'Matching ID': '',
            'Match Score': '',
            'Matching Images': '',
            'Remarks (If any)': 'No face detected'
        })
        with progress_lock:
            print(f"  ✗ No face detected")
        return result_rows
    
    # Step 2: Search for matches
    matches = search_matches(detection_id)
    
    if matches:
        for match_idx, match in enumerate(matches):
            matching_id = match['name']
            confidence = match['confidence']
            
            if match_idx == 0:
                result_rows.append({
                    'S.No': actual_idx,
                    'Source ID': source_id,
                    'Digitized (Yes/No)': 'Yes',
                    'Match Found? (Yes/No)': 'Yes',
                    'Matching ID': matching_id,
                    'Match Score': f"{confidence:.2f}",
                    'Matching Images': f"1: {source_id}.jpg\n2: {matching_id}.jpg",
                    'Remarks (If any)': 'Needs Update' if confidence < 90 else ''
                })
                with progress_lock:
                    print(f"  ✓ Match found: {matching_id} (Score: {confidence:.2f}%)")
            else:
                result_rows.append({
                    'S.No': '',
                    'Source ID': '',
                    'Digitized (Yes/No)': '',
                    'Match Found? (Yes/No)': '',
                    'Matching ID': matching_id,
                    'Match Score': f"{confidence:.2f}",
                    'Matching Images': f"1: {source_id}.jpg\n2: {matching_id}.jpg",
                    'Remarks (If any)': 'Alternate match'
                })
                with progress_lock:
                    print(f"    Alternative match: {matching_id} (Score: {confidence:.2f}%)")
    else:
        result_rows.append({
            'S.No': actual_idx,
            'Source ID': source_id,
            'Digitized (Yes/No)': 'Yes',
            'Match Found? (Yes/No)': 'No',
            'Matching ID': '',
            'Match Score': '',
            'Matching Images': '',
            'Remarks (If any)': 'No match found'
        })
        with progress_lock:
            print(f"  ✗ No match found")
    
    return result_rows


def save_to_excel(results: List[Dict], output_path: str):
    """Save results to Excel file."""
    df = pd.DataFrame(results)
    
    with pd.ExcelWriter(output_path, engine='openpyxl') as writer:
        df.to_excel(writer, sheet_name='Face Detection Results', index=False)
        
        workbook = writer.book
        worksheet = writer.sheets['Face Detection Results']
        
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
    """Process all images concurrently."""
    all_results = []
    processed_files = set()
    
    # Check if Excel file exists and load already processed images
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
    
    if already_processed > 0:
        print(f"Already processed: {already_processed} images")
    print(f"Remaining to process: {remaining} images")
    print(f"Total images: {total_images}")
    print(f"Using {MAX_WORKERS} concurrent workers\n")
    
    # Prepare image info tuples
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
                    
                    # Save progress every SAVE_INTERVAL images
                    if completed_count % SAVE_INTERVAL == 0:
                        actual_count = already_processed + completed_count
                        elapsed = time.time() - start_time
                        rate = completed_count / elapsed
                        eta = (remaining - completed_count) / rate if rate > 0 else 0
                        
                        print(f"\n--- Saving progress checkpoint at {actual_count} images ---")
                        print(f"Processed: {completed_count}/{remaining} | Rate: {rate:.2f} img/s | ETA: {eta/60:.1f} min")
                        save_to_excel(all_results, OUTPUT_EXCEL)
                        
            except Exception as e:
                print(f"Error processing image: {e}")
    
    # Final stats
    elapsed = time.time() - start_time
    rate = completed_count / elapsed if elapsed > 0 else 0
    print(f"\n{'='*70}")
    print(f"Processing Complete!")
    print(f"{'='*70}")
    print(f"Processed: {completed_count} images")
    print(f"Time: {elapsed:.1f} seconds ({elapsed/60:.1f} minutes)")
    print(f"Average rate: {rate:.2f} images/second")
    print(f"{'='*70}\n")
    
    return all_results


def main():
    """Main execution function."""
    print("=" * 70)
    print("Face Detection and Matching Processor (Multi-threaded)")
    print("=" * 70)
    print()
    
    if not os.path.exists(IMAGE_FOLDER):
        print(f"Error: Image folder not found: {IMAGE_FOLDER}")
        return
    
    print(f"Image folder: {IMAGE_FOLDER}")
    print(f"Output file: {OUTPUT_EXCEL}")
    print()
    
    # Process all images
    results = process_images_concurrent(IMAGE_FOLDER)
    
    # Save final results
    if results:
        save_to_excel(results, OUTPUT_EXCEL)
        print(f"✓ All {len(results)} results saved successfully!")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\nProcess interrupted by user.")
    except Exception as e:
        print(f"\n\nFatal error: {e}")
        import traceback
        traceback.print_exc()
