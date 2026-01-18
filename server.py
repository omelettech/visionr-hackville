#!/usr/bin/env python

"""Echo server using the asyncio API."""

import asyncio
from websockets.asyncio.server import serve


async def echo(websocket):
    async for message in websocket:
        print("server recive " + message)
        await websocket.send("server recive " + message)

# async def send_data(data):
#     print("sending data")
#     async with connect("ws://localhost:8765") as websocket:
#         await websocket.send(data)
#         # message = await websocket.recv()
#         # print(message)
#         message = await websocket.recv()
#         print(message)
#         return message

async def main():
    async with serve(echo, "localhost", 8765) as server:
        await server.serve_forever()
        

if __name__ == "__main__":
    asyncio.run(main())