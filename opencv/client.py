#!/usr/bin/env python

"""Client using the asyncio API."""

import asyncio
from websockets.asyncio.client import connect


async def hello():
    async with connect("ws://localhost:8765") as websocket:
        await websocket.send("Hello world!")
        message = await websocket.recv()
        print(message)

async def send_data(data):
    print("sending data")
    async with connect("ws://localhost:8765") as websocket:
        await websocket.send(data)
        # message = await websocket.recv()
        # print(message)
        message = await websocket.recv()
        print(message)
        return message

