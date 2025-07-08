    # backend/app/websocket_manager.py
from typing import Dict, List, Set
from fastapi import WebSocket, WebSocketDisconnect
import json
from datetime import datetime
import logging
import asyncio

logger = logging.getLogger(__name__)

class ConnectionManager:
    """WebSocket forbindelseshåndtering for real-time notifikationer"""
    
    def __init__(self):
        # Active connections: user_id -> list of websocket connections
        self.active_connections: Dict[int, List[WebSocket]] = {}
        
        # User roles for targeted messaging
        self.user_roles: Dict[WebSocket, str] = {}
        
        # Connection metadata
        self.connection_metadata: Dict[WebSocket, Dict] = {}
        
        # Statistics
        self.total_connections = 0
        self.messages_sent = 0
    
    async def connect(self, websocket: WebSocket, user_id: int, role: str = "user"):
        """Etabler WebSocket forbindelse"""
        try:
            await websocket.accept()
            
            # Add to active connections
            if user_id not in self.active_connections:
                self.active_connections[user_id] = []
            
            self.active_connections[user_id].append(websocket)
            self.user_roles[websocket] = role
            self.connection_metadata[websocket] = {
                "user_id": user_id,
                "role": role,
                "connected_at": datetime.utcnow(),
                "last_ping": datetime.utcnow()
            }
            
            self.total_connections += 1
            
            logger.info(f"User {user_id} ({role}) connected via WebSocket. Total connections: {self.total_connections}")
            
            # Send welcome message
            await self.send_personal_message({
                "type": "connection_established",
                "message": "Real-time forbindelse etableret",
                "timestamp": datetime.utcnow().isoformat(),
                "user_id": user_id
            }, websocket)
            
        except Exception as e:
            logger.error(f"Error connecting user {user_id}: {e}")
            raise
    
    def disconnect(self, websocket: WebSocket):
        """Afbryd WebSocket forbindelse"""
        user_id = None
        
        # Find and remove connection
        for uid, connections in self.active_connections.items():
            if websocket in connections:
                user_id = uid
                connections.remove(websocket)
                if not connections:
                    del self.active_connections[uid]
                break
        
        # Clean up metadata
        if websocket in self.user_roles:
            del self.user_roles[websocket]
        
        if websocket in self.connection_metadata:
            del self.connection_metadata[websocket]
        
        self.total_connections = max(0, self.total_connections - 1)
        
        logger.info(f"User {user_id} disconnected. Total connections: {self.total_connections}")
    
    async def send_personal_message(self, message: dict, websocket: WebSocket):
        """Send besked til specifik WebSocket forbindelse"""
        try:
            await websocket.send_text(json.dumps(message, default=str))
            self.messages_sent += 1
        except WebSocketDisconnect:
            logger.warning("WebSocket disconnected during message send")
            self.disconnect(websocket)
        except Exception as e:
            logger.error(f"Error sending personal message: {e}")
    
    async def send_to_user(self, message: dict, user_id: int):
        """Send besked til alle forbindelser for en specifik bruger"""
        if user_id not in self.active_connections:
            logger.debug(f"No active connections for user {user_id}")
            return
        
        # Add timestamp if not present
        if "timestamp" not in message:
            message["timestamp"] = datetime.utcnow().isoformat()
        
        dead_connections = []
        sent_count = 0
        
        for connection in self.active_connections[user_id]:
            try:
                await connection.send_text(json.dumps(message, default=str))
                sent_count += 1
                self.messages_sent += 1
            except WebSocketDisconnect:
                dead_connections.append(connection)
            except Exception as e:
                logger.error(f"Error sending message to user {user_id}: {e}")
                dead_connections.append(connection)
        
        # Clean up dead connections
        for dead_conn in dead_connections:
            self.disconnect(dead_conn)
        
        if sent_count > 0:
            logger.debug(f"Sent message to user {user_id} on {sent_count} connections")
    
    async def send_to_role(self, message: dict, role: str):
        """Send besked til alle brugere med specifik rolle"""
        if "timestamp" not in message:
            message["timestamp"] = datetime.utcnow().isoformat()
        
        sent_count = 0
        dead_connections = []
        
        for connection, conn_role in self.user_roles.items():
            if conn_role.lower() == role.lower():
                try:
                    await connection.send_text(json.dumps(message, default=str))
                    sent_count += 1
                    self.messages_sent += 1
                except WebSocketDisconnect:
                    dead_connections.append(connection)
                except Exception as e:
                    logger.error(f"Error sending message to role {role}: {e}")
                    dead_connections.append(connection)
        
        # Clean up dead connections
        for dead_conn in dead_connections:
            self.disconnect(dead_conn)
        
        logger.info(f"Sent message to {sent_count} users with role '{role}'")
    
    async def broadcast_to_all(self, message: dict):
        """Send besked til alle forbundne brugere"""
        if "timestamp" not in message:
            message["timestamp"] = datetime.utcnow().isoformat()
        
        sent_count = 0
        dead_connections = []
        
        for user_connections in self.active_connections.values():
            for connection in user_connections:
                try:
                    await connection.send_text(json.dumps(message, default=str))
                    sent_count += 1
                    self.messages_sent += 1
                except WebSocketDisconnect:
                    dead_connections.append(connection)
                except Exception as e:
                    logger.error(f"Error broadcasting message: {e}")
                    dead_connections.append(connection)
        
        # Clean up dead connections
        for dead_conn in dead_connections:
            self.disconnect(dead_conn)
        
        logger.info(f"Broadcast message to {sent_count} connections")
    
    async def handle_ping_pong(self):
        """Håndter ping/pong for at holde forbindelser i live"""
        while True:
            try:
                dead_connections = []
                
                for connection, metadata in self.connection_metadata.items():
                    try:
                        # Send ping
                        await connection.send_text(json.dumps({
                            "type": "ping",
                            "timestamp": datetime.utcnow().isoformat()
                        }))
                        
                        # Update last ping time
                        metadata["last_ping"] = datetime.utcnow()
                        
                    except WebSocketDisconnect:
                        dead_connections.append(connection)
                    except Exception as e:
                        logger.error(f"Error sending ping: {e}")
                        dead_connections.append(connection)
                
                # Clean up dead connections
                for dead_conn in dead_connections:
                    self.disconnect(dead_conn)
                
                # Wait 30 seconds before next ping
                await asyncio.sleep(30)
                
            except Exception as e:
                logger.error(f"Error in ping/pong handler: {e}")
                await asyncio.sleep(30)
    
    def get_connection_stats(self) -> Dict:
        """Hent statistikker over forbindelser"""
        role_counts = {}
        for role in self.user_roles.values():
            role_counts[role] = role_counts.get(role, 0) + 1
        
        return {
            "total_connections": self.total_connections,
            "unique_users": len(self.active_connections),
            "messages_sent": self.messages_sent,
            "role_distribution": role_counts,
            "active_users": list(self.active_connections.keys())
        }

# Global connection manager instance
manager = ConnectionManager()
