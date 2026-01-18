import cv2
import pupil_apriltags
import numpy as np
import asyncio
import json
from websockets.asyncio.client import connect

# --- CONFIGURATION ---
TAG_SIZE = 0.05  # 5 cm
SERVER_URI = "ws://localhost:8765" # Where we are sending data

tag_to_name = {
    0: "Exit", 1: "Enter", 2: "Left", 
    3: "Right", 4: "Up", 5: "Down"
}

async def main():
    # 1. Setup Camera
    cap = cv2.VideoCapture(0)
    
    # Get actual resolution for correct camera params (Fixes "minima" error)
    ret, frame = cap.read()
    if not ret:
        print("Could not read from webcam.")
        return
    h, w = frame.shape[:2]
    camera_params = [w, w, w/2, h/2] # [fx, fy, cx, cy]

    # 2. Setup Detector
    detector = pupil_apriltags.Detector(families='tag36h11', quad_decimate=2.0)

    print(f"Connecting to WebSocket server at {SERVER_URI}...")
    
    # 3. Connect to Server
    try:
        async with connect(SERVER_URI) as websocket:
            print("Connected! Press 'q' to quit.")

            while True:
                ret, frame = cap.read()
                if not ret: break

                gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
                detections = detector.detect(gray, estimate_tag_pose=True, 
                                             camera_params=camera_params, tag_size=TAG_SIZE)

                detected_data = []

                for detection in detections:
                    # -- Visuals --
                    corners = detection.corners.astype(int)
                    cv2.polylines(frame, [corners], isClosed=True, color=(0, 255, 0), thickness=2)
                    tag_name = tag_to_name.get(detection.tag_id, "Unknown")
                    cv2.putText(frame, f"ID: {tag_name}", (corners[0][0], corners[0][1] - 10),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 2)

                    # -- Prepare Data to Send --
                    if detection.pose_t is not None:
                        # Flatten pose to a simple list [x, y, z]
                        pose = detection.pose_t.flatten().tolist()
                        
                        tag_info = {
                            "id": detection.tag_id,
                            "name": tag_name,
                            "distance_m": round(pose[2], 3), # Z is depth
                            "pose": [round(n, 3) for n in pose]
                        }
                        detected_data.append(tag_info)

                # -- Send Data --
                if detected_data:
                    # Convert list of dicts to JSON string
                    json_message = json.dumps(detected_data)
                    await websocket.send(json_message)
                    # print(f"Sent: {json_message}") # Uncomment to debug

                # -- Display Video --
                cv2.imshow('AprilTag Sender', frame)
                
                # Allow async loop to breathe (Critical for websockets)
                await asyncio.sleep(0.01) 
                
                if cv2.waitKey(1) & 0xFF == ord('q'):
                    break

    except ConnectionRefusedError:
        print(f"ERROR: Could not connect to {SERVER_URI}.")
        print("Make sure your WebSocket SERVER is running first.")
    
    cap.release()
    cv2.destroyAllWindows()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass