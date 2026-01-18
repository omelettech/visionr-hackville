import cv2
import pupil_apriltags
import asyncio
import json
from websockets.asyncio.server import serve

# --- CONFIGURATION ---
TAG_SIZE = 0.05
PORT = 8765

# Store all connected clients in a set
CONNECTED_CLIENTS = set()

async def handler(websocket):
    """
    Handles new connections.
    We just add the client to the list and keep the connection open.
    We do NOT wait for messages from the client.
    """
    print(f"New Client Connected! (Total: {len(CONNECTED_CLIENTS) + 1})")
    CONNECTED_CLIENTS.add(websocket)
    try:
        # Keep the connection alive until the client disconnects
        await websocket.wait_closed()
    finally:
        CONNECTED_CLIENTS.remove(websocket)
        print(f"Client Disconnected. (Total: {len(CONNECTED_CLIENTS)})")

async def camera_loop():
    """
    Runs the AprilTag detection and broadcasts data to connected clients.
    """
    cap = cv2.VideoCapture(0)
    
    # Auto-calc camera params
    ret, frame = cap.read()
    if not ret: return
    h, w = frame.shape[:2]
    camera_params = [w, w, w/2, h/2]
    
    detector = pupil_apriltags.Detector(families='tag36h11', quad_decimate=2.0)

    print("Camera Loop Started. Waiting for tags...")

    while True:
        ret, frame = cap.read()
        if not ret: break

        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        detections = detector.detect(gray, estimate_tag_pose=True, 
                                     camera_params=camera_params, tag_size=TAG_SIZE)

        detected_data = []

        # -- Process Detections --
        for detection in detections:
            # Draw box (visual feedback for server admin)
            corners = detection.corners.astype(int)
            cv2.polylines(frame, [corners], isClosed=True, color=(0, 255, 0), thickness=2)

            # Prepare Data
            if detection.pose_t is not None:
                pose = detection.pose_t.flatten().tolist()
                detected_data.append({
                    "id": detection.tag_id,
                    "z_distance": round(pose[2], 3),
                    "pose": [round(n, 3) for n in pose]
                })

        # -- BROADCAST TO CLIENTS --
        # Only do the work if we have clients and data
        if CONNECTED_CLIENTS and detected_data:
            message = json.dumps(detected_data)
            
            # Send to all connected clients
            # We use a copy (list(CONNECTED_CLIENTS)) to avoid errors if a client disconnects mid-loop
            for ws in list(CONNECTED_CLIENTS):
                try:
                    await ws.send(message)
                except:
                    pass # Connection errors are handled by the handler

        # Show video locally
        cv2.imshow('Server View', frame)
        
        # Async sleep is crucial to let the Server Handler run!
        await asyncio.sleep(0.01)

        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

    cap.release()
    cv2.destroyAllWindows()

async def main():
    # 1. Start the WebSocket Server (it runs in the background)
    async with serve(handler, "localhost", PORT):
        print(f"Server started on ws://localhost:{PORT}")
        
        # 2. Run the Camera Loop (this keeps the program alive)
        await camera_loop()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass