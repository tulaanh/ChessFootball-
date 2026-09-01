import mqtt, { MqttClient } from 'mqtt';
import { BoardState, TeamColor } from '@/engine/types';

export type NetworkPacket =
  | { type: 'JOIN_REQUEST'; senderId: string }
  | { type: 'JOIN_ACCEPT'; hostId: string; board: BoardState }
  | { type: 'SYNC_STATE'; board: BoardState; senderId: string }
  | { type: 'EMOTE'; emoji: string; team: TeamColor; senderId: string }
  | { type: 'RESET_REQUEST'; senderId: string }
  | { type: 'HEARTBEAT'; senderId: string }
  | { type: 'LEAVE'; senderId: string };

export interface MultiplayerCallbacks {
  onConnected: (peerId: string, role: TeamColor) => void;
  onDisconnected: () => void;
  onPacketReceived: (packet: NetworkPacket) => void;
  onError: (errorMsg: string) => void;
  onStatusUpdate?: (status: string) => void;
}

// Ultra-reliable public MQTT brokers over Secure WebSocket (WSS)
const BROKER_URLS = [
  'wss://broker.emqx.io:8084/mqtt',
  'wss://broker.hivemq.com:8884/mqtt',
  'wss://test.mosquitto.org:8081',
];

class MultiplayerService {
  private client: MqttClient | null = null;
  private callbacks: MultiplayerCallbacks | null = null;
  private myClientId: string = '';
  private topic: string = '';
  private joinInterval: number | null = null;
  private isConnectedToPeer: boolean = false;
  public myRole: TeamColor | null = null;
  public roomId: string | null = null;
  public isHost: boolean = false;

  public init(callbacks: MultiplayerCallbacks) {
    this.callbacks = callbacks;
  }

  private connectBroker(brokerIndex = 0, onConnectSuccess: () => void, onError: (err: Error) => void) {
    if (brokerIndex >= BROKER_URLS.length) {
      onError(new Error('Không thể kết nối đến tất cả máy chủ đám mây!'));
      return;
    }

    const brokerUrl = BROKER_URLS[brokerIndex];
    this.myClientId = `player_${Math.random().toString(36).substring(2, 9)}_${Date.now()}`;

    if (this.callbacks?.onStatusUpdate) {
      this.callbacks.onStatusUpdate(`Đang kết nối đám mây (${brokerIndex + 1}/${BROKER_URLS.length})...`);
    }

    const client = mqtt.connect(brokerUrl, {
      clientId: this.myClientId,
      clean: true,
      connectTimeout: 8000,
      reconnectPeriod: 3000,
    });

    let connected = false;

    client.on('connect', () => {
      connected = true;
      this.client = client;
      onConnectSuccess();
    });

    client.on('error', (err) => {
      console.warn(`Broker error at ${brokerUrl}:`, err);
      if (!connected) {
        client.end(true);
        // Try next broker
        this.connectBroker(brokerIndex + 1, onConnectSuccess, onError);
      }
    });

    client.on('message', (_topic, message) => {
      try {
        const packet = JSON.parse(message.toString()) as NetworkPacket;
        this.handleIncomingPacket(packet);
      } catch (e) {
        console.error('Failed to parse MQTT message:', e);
      }
    });

    client.on('close', () => {
      if (this.isConnectedToPeer && this.callbacks) {
        this.callbacks.onStatusUpdate?.('Đang tái kết nối đường truyền...');
      }
    });
  }

  /**
   * Host creates a new room with a random 6-digit room code
   */
  public createRoom(onRoomCreated: (code: string) => void) {
    this.cleanup();
    this.isHost = true;
    this.myRole = 'white';

    const randomSuffix = Math.floor(100000 + Math.random() * 900000);
    const roomCode = `cf-${randomSuffix}`;
    this.roomId = roomCode;
    this.topic = `chessfootball/v1/room/${roomCode}`;

    this.connectBroker(
      0,
      () => {
        if (!this.client) return;
        this.client.subscribe(this.topic, { qos: 1 }, (err) => {
          if (err) {
            this.callbacks?.onError('Lỗi đăng ký phòng trên máy chủ!');
            return;
          }
          onRoomCreated(roomCode);
          this.callbacks?.onStatusUpdate?.('🟢 Phòng đã tạo thành công! Đang chờ đối thủ...');
        });
      },
      (err) => {
        this.callbacks?.onError(err.message);
      }
    );
  }

  /**
   * Guest joins an existing room by room code
   */
  public joinRoom(roomCode: string, onJoined: () => void, initialBoard?: BoardState) {
    this.cleanup();
    this.isHost = false;
    this.myRole = 'black';
    const cleanRoomCode = roomCode.trim().toLowerCase();
    this.roomId = cleanRoomCode;
    this.topic = `chessfootball/v1/room/${cleanRoomCode}`;

    this.connectBroker(
      0,
      () => {
        if (!this.client) return;
        this.client.subscribe(this.topic, { qos: 1 }, (err) => {
          if (err) {
            this.callbacks?.onError('Lỗi tham gia phòng!');
            return;
          }

          this.callbacks?.onStatusUpdate?.('Đang liên lạc với Chủ phòng...');

          // Send JOIN_REQUEST repeatedly until host responds
          const sendJoin = () => {
            this.sendPacket({
              type: 'JOIN_REQUEST',
              senderId: this.myClientId,
            });
          };

          sendJoin();
          this.joinInterval = window.setInterval(sendJoin, 1200);

          // Timeout after 15s if no host responds
          setTimeout(() => {
            if (!this.isConnectedToPeer && this.joinInterval) {
              this.callbacks?.onStatusUpdate?.('Chưa thấy phản hồi từ chủ phòng. Đang tiếp tục thử...');
            }
          }, 6000);
        });
      },
      (err) => {
        this.callbacks?.onError(err.message);
      }
    );
  }

  private handleIncomingPacket(packet: NetworkPacket) {
    // Ignore packets sent by ourselves
    if ('senderId' in packet && packet.senderId === this.myClientId) {
      return;
    }

    if (packet.type === 'JOIN_REQUEST' && this.isHost) {
      // Host receives join request from guest -> Accept and send current board
      if (!this.isConnectedToPeer) {
        this.isConnectedToPeer = true;
        this.callbacks?.onConnected(this.roomId!, 'white');
      }
      this.sendPacket({
        type: 'JOIN_ACCEPT',
        hostId: this.myClientId,
        board: (window as any).__CHESS_FOOTBALL_BOARD_STATE__ || (null as any),
      });
      return;
    }

    if (packet.type === 'JOIN_ACCEPT' && !this.isHost) {
      // Guest receives join accept from host
      if (this.joinInterval) {
        clearInterval(this.joinInterval);
        this.joinInterval = null;
      }
      if (!this.isConnectedToPeer) {
        this.isConnectedToPeer = true;
        this.callbacks?.onConnected(this.roomId!, 'black');
        if (packet.board) {
          this.callbacks?.onPacketReceived({
            type: 'SYNC_STATE',
            board: packet.board,
            senderId: packet.hostId,
          });
        }
      }
      return;
    }

    if (packet.type === 'LEAVE') {
      this.callbacks?.onDisconnected();
      return;
    }

    if (this.callbacks) {
      this.callbacks.onPacketReceived(packet);
    }
  }

  public sendPacket(packet: NetworkPacket) {
    if (this.client && this.client.connected && this.topic) {
      try {
        const payload = JSON.stringify(packet);
        this.client.publish(this.topic, payload, { qos: 1 });
      } catch (e) {
        console.error('Failed to send MQTT packet:', e);
      }
    }
  }

  public cleanup() {
    if (this.joinInterval) {
      clearInterval(this.joinInterval);
      this.joinInterval = null;
    }
    if (this.client) {
      try {
        if (this.isConnectedToPeer && this.topic) {
          this.sendPacket({ type: 'LEAVE', senderId: this.myClientId });
        }
        this.client.end(true);
      } catch (e) {
        // ignore
      }
      this.client = null;
    }
    this.isConnectedToPeer = false;
    this.roomId = null;
    this.myRole = null;
    this.isHost = false;
    this.topic = '';
  }
}

export const multiplayerService = new MultiplayerService();
