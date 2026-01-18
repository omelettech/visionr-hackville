import cv2
import pupil_apriltags
import asyncio
import json
from websockets.asyncio.server import serve

# --- CONFIGURATION ---
TAG_SIZE = 0.08
PORT = 8765
tag_to_name = {
    0: "Exit", 1: "Enter", 2: "Map",
    3: "Room 1", 4: "Room 2", 5: "Room 3",
}
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

    # Force 1080p Resolution
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1920)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 1080)    
    
    # Auto-calc camera params
    ret, frame = cap.read()
    if not ret: return
    #h, w = frame.shape[:2]
    camera_params = [1250.0, 1250.0, 960.0, 540.0]
    
    detector = pupil_apriltags.Detector(families='tag36h11', quad_decimate=2.0)

    print("Camera Loop Started. Waiting for tags...")

    ws_sent_already = False

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
                ws_sent_already = False
                pose = detection.pose_t.flatten().tolist()
                detected_data.append({
                    "id":detection.tag_id,
                    "z_distance": round(pose[2], 3),
                    "pose": [round(n, 3) for n in pose]
                })
            
            


                tag_id = tag_to_name.get(detection.tag_id, "Unknown")
                cv2.putText(frame, f"ID: {tag_id}", (corners[0][0], corners[0][1] - 10),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 2)
        # -- BROADCAST TO CLIENTS --
        if CONNECTED_CLIENTS:
            if detected_data:
                message = json.dumps(detected_data)
                ws_sent_already = True
                for ws in list(CONNECTED_CLIENTS):
                    try:
                        await ws.send(message)
                    except:
                        pass
            elif ws_sent_already:
                # Send one empty message to clear the state
                message = json.dumps([])
                ws_sent_already = False
                for ws in list(CONNECTED_CLIENTS):
                    try:
                        await ws.send(message)
                    except:
                        pass

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