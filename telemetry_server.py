{'type': 'telemetry', 'timestamp': '2026-05-18T10:45:41.191448+00:00', 'bot_id': '952c3b76-41fe-4fc7-8c0a-c29ccdf85697', 'position': {'lat': 23.020756, 'lng': 72.53335, 'alt': 0.0, 'x': 4.644335760687081, 'y': -0.7848241098396816, 'z': 0.0}, 'attitude': {'roll': 0.0, 'pitch': 0.0, 'yaw': 1.8152969670833383}, 'battery': {'voltage': 26.644, 'current': 0.0, 'percentage': 53.288000000000004}, 'speed': 0.0, 'heading': 1.8152969670833383, 'botMode': 'AUTO', 'isArmed': False, 'connected': True, 'gps': {'fix': '-', 'satellites': 12}, 'sigma': {'x': 0.17184315554564555, 'y': 0.17184315554564555}, 'telemHz': 0.0, 'uptimeMs': 4887100, 'packetNumber': 192, 'mission': {'id': '3a10afc1-21ab-4588-af69-c7b2f53a33d4', 'name': 'mission-2026-05-13T15:34:10+00:00', 'status': 'completed', 'progress': {'reached': 0, 'total': 2, 'percent': 0.0, 'dist_to_next_m': 27.815099612286627, 'dist_remaining_m': 43.73828714684268}, 'started_at': '2026-05-13T15:34:10+00:00'}, 'waypoints': [{'sequence': 0, 'lat': 23.02053584118563, 'lng': 72.53347903490068, 'alt': 10.0, 'label': '', 'reached': False, 'reached_at': None}, {'sequence': 1, 'lat': 23.020538308126447, 'lng': 72.53363460302354, 'alt': 10.0, 'label': '', 'reached': False, 'reached_at': None}]}


"""
Telemetry WebSocket Bridge
Reads JSON telemetry from serial (COM15) and broadcasts to the frontend via WebSocket.
Run this alongside your Next.js frontend.

Usage:
    pip install pyserial websockets
    python telemetry_server.py
"""

import json
import serial
import asyncio
import websockets
import time
from datetime import datetime
from threading import Thread, Lock

# ─────────────────────────────────────────
#  CONFIG
# ─────────────────────────────────────────
SERIAL_PORT = "COM6"        # Change to your port
BAUD_RATE   = 460800
WS_HOST     = "0.0.0.0"
WS_PORT     = 8765           # Frontend connects to ws://localhost:8765

# ─────────────────────────────────────────
#  SHARED STATE
# ─────────────────────────────────────────
latest_telemetry = {}
telemetry_lock = Lock()
connected_clients = set()
ser = None  # Global serial object
current_bot_mode = "MANUAL"
current_arm_status = False
packet_count = 0
stats = {
    "total": 0,
    "data_pkts": 0,
    "heartbeats": 0,
    "parse_errors": 0,
    "start_time": time.monotonic(),
}

# ─────────────────────────────────────────
#  SERIAL READER (runs in a thread)
# ─────────────────────────────────────────
def serial_reader():
    global latest_telemetry, packet_count, ser
    buffer = b""

    print("=" * 52)
    print("  UGV Telemetry Bridge")
    print(f"  Serial : {SERIAL_PORT} @ {BAUD_RATE}")
    print(f"  WS     : ws://{WS_HOST}:{WS_PORT}")
    print("=" * 52)

    try:
        ser = serial.Serial(SERIAL_PORT, BAUD_RATE, timeout=0.1)
        print(f"  Serial opened successfully\n")
    except serial.SerialException as e:
        print(f"\n  [SERIAL ERROR] {e}")
        print(f"  Check: is {SERIAL_PORT} correct? Is device connected?")
        return

    while True:
        try:
            chunk = ser.read(ser.in_waiting or 1)
            if not chunk:
                continue

            buffer += chunk

            while b"\n" in buffer:
                line, buffer = buffer.split(b"\n", 1)
                line = line.strip()

                if not line:
                    continue

                stats["total"] += 1
                packet_count += 1

                try:
                    packet = json.loads(line.decode("utf-8"))
                except (json.JSONDecodeError, UnicodeDecodeError) as e:
                    stats["parse_errors"] += 1
                    continue

                data = packet.get("data")
                # waypoints = packet.get("waypoints", [])
                mission = packet.get("mission", {})
                waypoints = mission.get("waypoints", [])

                if data is not None:
                    stats["data_pkts"] += 1

                    # Map telemetry_data.py fields -> frontend Zustand store fields
                    mapped = {
                        "type": "telemetry",
                        "timestamp": packet.get("ts", datetime.now().isoformat()),
                        "bot_id": packet.get("bot_id", "unknown"),
                        "position": {
                            "lat": float(data.get("lat", 0)),
                            "lng": float(data.get("long", 0)),
                            "alt": 0.0,
                            "x": float(data.get("x", 0)),
                            "y": float(data.get("y", 0)),
                            "z": 0.0,
                        },
                        "attitude": {
                            "roll": 0.0,
                            "pitch": 0.0,
                            "yaw": float(data.get("yaw", 0)),
                        },
                        "battery": {
                            "voltage": float(data.get("batv", 0)),
                            "current": 0.0,
                            "percentage": min(100, max(0, (float(data.get("batv", 0)) / 50.0) * 100)),
                        },
                        "speed": float(data.get("vx") or data.get("v") or data.get("speed") or 0),
                        "heading": float(data.get("yaw", 0)),
                        "botMode": current_bot_mode,
                        "isArmed": current_arm_status,
                        "connected": True,
                        "gps": {
                            "fix": data.get("gps_fix", ""),
                            "satellites": int(data.get("sat", 0)),
                        },
                        "sigma": {
                            "x": float(data.get("s_x", 0)),
                            "y": float(data.get("s_y", 0)),
                        },
                        "telemHz": float(data.get("hz", 0)),
                        "uptimeMs": int(data.get("uptime_ms", 0)),
                        "packetNumber": packet_count,
                    }

                    # Forward any raw data fields not already captured in structured mappings
                    _already_mapped = {"lat", "long", "x", "y", "yaw", "batv",
                                       "vx", "v", "speed", "gps_fix", "sat",
                                       "s_x", "s_y", "hz", "uptime_ms"}
                    for _k, _v in data.items():
                        if _k not in _already_mapped and _k not in mapped:
                            mapped[_k] = _v

                    if mission:
                        mapped["mission"] = {
                            "id":         mission.get("id"),
                            "name":       mission.get("name"),
                            "status":     mission.get("status"),
                            "progress":   mission.get("progress", {}),
                            "started_at": mission.get("started_at"),
                        }

                    if waypoints:
                        mapped["waypoints"] = [
                            {
                                "sequence":   wp.get("sequence"),
                                "lat":        wp.get("lat"),
                                "lng":        wp.get("lng"),
                                "alt":        wp.get("alt"),
                                "label":      wp.get("label", ""),
                                "reached":    wp.get("reached", False),
                                "reached_at": wp.get("reached_at"),
                            }
                            for wp in waypoints
                        ]

                    with telemetry_lock:
                        latest_telemetry = mapped
                    
                    # Print to console
                    now = datetime.now().strftime("%H:%M:%S.%f")[:-3]
                    print(f"  <<< [RECV] #{packet_count} | X:{data.get('x')} Y:{data.get('y')} "
                          f"Yaw:{data.get('yaw')}° Spd:{mapped['speed']} Bat:{data.get('batv')}V")
                else:
                    stats["heartbeats"] += 1

                    # Send heartbeat to frontend
                    hb = {
                        "type": "heartbeat",
                        "timestamp": packet.get("ts", datetime.now().isoformat()),
                        "bot_id": packet.get("bot_id", "unknown"),
                        "packetNumber": packet_count,
                    }
                    with telemetry_lock:
                        latest_telemetry = {**latest_telemetry, **hb}

                # Print stats every 20 packets
                if stats["total"] % 20 == 0:
                    elapsed = time.monotonic() - stats["start_time"]
                    rate = stats["total"] / elapsed if elapsed > 0 else 0
                    print(f"  [STATS] {stats['total']} total | "
                          f"{stats['data_pkts']} data | "
                          f"{stats['heartbeats']} HB | "
                          f"{stats['parse_errors']} err | "
                          f"{rate:.1f} pkt/s")

        except serial.SerialException as e:
            print(f"  [SERIAL ERROR] {e}")
            break
        except Exception as e:
            print(f"  [ERROR] {e}")
            continue

# ─────────────────────────────────────────
#  WEBSOCKET SERVER
# ─────────────────────────────────────────
async def ws_handler(websocket):
    connected_clients.add(websocket)
    client_ip = websocket.remote_address
    print(f"  [WS] Client connected: {client_ip} ({len(connected_clients)} total)")

    async def sender():
        try:
            while True:
                with telemetry_lock:
                    data = latest_telemetry.copy() if latest_telemetry else None
                if data:
                    # Inject current mode immediately for real-time UI response
                    data["botMode"] = current_bot_mode
                    data["isArmed"] = current_arm_status
                    await websocket.send(json.dumps(data))
                await asyncio.sleep(0.05) # Faster update rate
        except Exception:
            pass

    async def receiver():
        global ser
        try:
            async for message in websocket:
                try:
                    command = json.loads(message)
                    if command.get("type") == "ping":
                        # Respond with pong for latency check
                        await websocket.send(json.dumps({
                            "type": "pong",
                            "ts": command.get("ts")
                        }))
                    elif command.get("type") == "command":
                        cmd_data = command.get("data", {})
                        
                        # Update local state if it's a mode change
                        if "botMode" in cmd_data:
                            global current_bot_mode
                            current_bot_mode = cmd_data["botMode"]
                            
                        # Update local state if it's an arm status change
                        if "armStatus" in cmd_data:
                            global current_arm_status
                            current_arm_status = (cmd_data["armStatus"] == "Active")
                            
                        if ser and ser.is_open:
                            ser.write((json.dumps(cmd_data) + "\n").encode("utf-8"))
                            
                            # Use appropriate header for logging
                            header = "Speed/Direction" if "speed" in cmd_data else "Cruise Speed" if "cruiseSpeed" in cmd_data else "Mode"
                            print(f"  >>> [SEND] : {header} data = {cmd_data}")
                    elif command.get("type") == "mission":
                        mission_data = command.get("waypoints", [])
                        if ser and ser.is_open:
                            # Send the whole mission as a single JSON line
                            payload = {"mission": mission_data}
                            ser.write((json.dumps(payload) + "\n").encode("utf-8"))
                            
                            if not mission_data:
                                print(f"  >>> [MISSION] : Waypoint data = Mission Cleared (0 waypoints)")
                            else:
                                print(f"  >>> [MISSION] : Waypoint data = Sent {len(mission_data)} waypoints")
                                for wp in mission_data:
                                    print(f"      WP{wp.get('sequence')} | Lat:{wp.get('lat')} Lng:{wp.get('lng')}")
                except json.JSONDecodeError:
                    print(f"  [WS ERROR] Invalid JSON received: {message}")
        except Exception:
            pass

    try:
        await asyncio.gather(sender(), receiver())
    finally:
        connected_clients.discard(websocket)
        print(f"  [WS] Client disconnected: {client_ip} ({len(connected_clients)} total)")

async def start_ws_server():
    print(f"  [WS] Server starting on ws://{WS_HOST}:{WS_PORT}")
    async with websockets.serve(ws_handler, WS_HOST, WS_PORT):
        await asyncio.Future()  # Run forever

# ─────────────────────────────────────────
#  MAIN
# ─────────────────────────────────────────
def main():
    # Start serial reader in a background thread
    serial_thread = Thread(target=serial_reader, daemon=True)
    serial_thread.start()

    # Run WebSocket server in the main async loop
    try:
        asyncio.run(start_ws_server())
    except KeyboardInterrupt:
        print("\n\n  Stopped by user.")
        elapsed = time.monotonic() - stats["start_time"]
        rate = stats["total"] / elapsed if elapsed > 0 else 0
        print(f"  Final stats: {stats['total']} pkts in {elapsed:.1f}s ({rate:.1f} pkt/s)")

if __name__ == "__main__":
    main()
