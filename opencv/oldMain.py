import cv2
#from cv2 import calibrateCamera
import pupil_apriltags
import numpy as np
import asyncio
from websockets.asyncio.client import connect
import json


tag_to_name = {
    0: "Exit",
    1: "Enter",
    2: "Left",
    3: "Right",
    4: "Up",
    5: "Down"
}

# Camera parameters: [fx, fy, cx, cy]
# fx, fy: focal length in pixels (approximate for standard webcam)
# cx, cy: optical center in pixels (approximate for 640x480 resolution)
CAMERA_PARAMS = [600, 600, 320, 240]

# Tag size in meters
# IMPORTANT: Measure the physical size of the black square of your tag in meters
# If this value is incorrect, the distance (Z estimate) will be wrong.
TAG_SIZE = 0.05


def main():
    # 1. Initialize the video capture (0 is usually the default webcam)
    cap = cv2.VideoCapture(0)
    
    # 2. Create the AprilTag detector
    # families can be 'tag36h11', 'tag25h9', 'tag16h5', etc.
    # quad_decimate=2.0 reduces image resolution for speed and noise reduction
    # quad_sigma=0.0 blur, increasing to 0.8 can help with noise
    detector = pupil_apriltags.Detector(families='tag36h11', quad_decimate=1.0, quad_sigma=0.0)

    print("Press 'q' to quit...")

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        # 3. Convert frame to grayscale (AprilTag detection requires grayscale)
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

        # 4. Detect tags
        # estimate_tag_pose=True to get the detection pose
        detections = detector.detect(gray, estimate_tag_pose=True, camera_params=CAMERA_PARAMS, tag_size=TAG_SIZE)

        # 5. Loop over detections and draw them
        for detection in detections:
            # Extract the bounding box (c)orners
            corners = detection.corners.astype(int)
            
            # Draw the bounding box
            # corners are ordered: top-left, top-right, bottom-right, bottom-left
            cv2.polylines(frame, [corners], isClosed=True, color=(0, 255, 0), thickness=2)

            # Draw the center point
            center = detection.center.astype(int)
            cv2.circle(frame, tuple(center), 5, (0, 0, 255), -1)

            # Draw the Tag ID
            tag_id = tag_to_name.get(detection.tag_id, "Unknown")
            cv2.putText(frame, f"ID: {tag_id}", (corners[0][0], corners[0][1] - 10),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 2)
            
            # Display Pose (Relative Position)
            if detection.pose_t is not None:
                # pose_t is a translation vector [x, y, z] in meters/units defined by tag_size
                x, y, z = detection.pose_t.flatten()
                
                # Z is the depth (distance from camera)
                pose_text = f"X: {x:.2f} Y: {y:.2f} Depth: {z:.2f}m Tag ID: {tag_id}"

                #print(pose_text)
                
                cv2.putText(frame, pose_text, (corners[0][0], corners[0][1] - 30),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 100, 255), 2)

        # Show the result
        cv2.imshow('AprilTag Detection', frame)

        # Exit on 'q' key
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

    cap.release()
    cv2.destroyAllWindows()

if __name__ == "__main__":
    main()