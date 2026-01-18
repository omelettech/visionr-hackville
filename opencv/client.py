import asyncio
from websockets.asyncio.client import connect
import json

SERVER_URI = "ws://localhost:8765"

async def listen():
    print(f"Attempting to connect to {SERVER_URI}...")
    
    async with connect(SERVER_URI) as websocket:
        print("Connected! Waiting for data...")
        
        # This loop runs forever, waiting for the server to push data
        async for message in websocket:
            data = json.loads(message)
            print(f"Received update: {data}")

if __name__ == "__main__":
    try:
        asyncio.run(listen())
    except ConnectionRefusedError:
        print("Could not connect. Is the Server script running?")
    except KeyboardInterrupt:
        print("Stopped.")