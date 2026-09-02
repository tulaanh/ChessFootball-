import mqtt, { MqttClient } from 'mqtt';
import { BoardState, TeamColor } from '@/engine/types';

export type NetworkPacket =
  | { type: 'JOIN_REQUEST'; senderId: string }
  | { type: 'JOIN_ACCEPT'; hostId: string; board?: BoardState }
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

// Public MQTT WSS Brokers list for high reliability
const BROKER_URLS = [
  'wss://broker.emqx.io:8084/mqtt',
  'wss://broker.hivemq.com:8884/mqtt',
  'wss://public.mqtthq.com:8084/mqtt',
  'wss://test.mosquitto.org:8081',
];

class MultiplayerService {
  private client: MqttClient | null = null;
  private callbacks: MultiplayerCallbacks | null = null;
  private myClientId: string = '';
  private topic: string = '';
  private joinInterval: number | null = null;
  private joinTimeoutTimer: number | null = null;
  public isConnectedToPeer: boolean = false;
  public myRole: TeamColor | null = null;
  public roomId: string | null = null;
  public isHost: boolean = false;

  public init(callbacks: MultiplayerCallbacks) {
    this.callbacks = callbacks;
  }

  private connectBroker(brokerIndex = 0, onConnectSuccess: () => void, onError: (err: Error) => void) {
    if (brokerIndex >= BROKER_URLS.length) {
      onError(new Error('Không thể kết nối đến máy chủ mạng P2P. Vui lòng kiểm tra lại kết nối Internet!'));
      return;
    }

    const brokerUrl = BROKER_URLS[brokerIndex];
    this.myClientId = `chessfoot_${Math.random().toString(36).substring(2, 8)}_${Date.now()}`;

    if (this.callbacks?.onStatusUpdate) {
      this.callbacks.onStatusUpdate(`Đang kết nối cổng máy chủ (${brokerIndex + 1}/${BROKER_URLS.length})...`);
    }

    let isSuccess = false;

    try {
      const client = mqtt.connect(brokerUrl, {
        clientId: this.myClientId,
        clean: true,
        connectTimeout: 6000,
        reconnectPeriod: 2500,
        keepalive: 30,
      });

      const timeoutId = window.setTimeout(() => {
        if (!isSuccess) {
          console.warn(`Timeout connecting to ${brokerUrl}`);
          try {
            client.end(true);
          } catch (e) {}
          this.connectBroker(brokerIndex + 1, onConnectSuccess, onError);
        }
      }, 6500);

      client.on('connect', () => {
        if (isSuccess) return;
        isSuccess = true;
        clearTimeout(timeoutId);
        this.client = client;
        console.log(`Connected to broker: ${brokerUrl}`);
        onConnectSuccess();
      });

      client.on('error', (err) => {
        console.warn(`Broker error at ${brokerUrl}:`, err);
        if (!isSuccess) {
          clearTimeout(timeoutId);
          try {
            client.end(true);
          } catch (e) {}
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
        if (this.isConnectedToPeer && this.callbacks?.onStatusUpdate) {
          this.callbacks.onStatusUpdate('Đang tái kết nối đường truyền...');
        }
      });
    } catch (err: any) {
      this.connectBroker(brokerIndex + 1, onConnectSuccess, onError);
    }
  }

  /**
   * Host creates a new room with a 6-digit room code
   */
  public createRoom(onRoomCreated: (code: string) => void) {
    this.cleanup();
    this.isHost = true;
    this.myRole = 'white';

    const randomSuffix = Math.floor(100000 + Math.random() * 900000);
    const roomCode = `cf-${randomSuffix}`;
    this.roomId = roomCode;
    this.topic = `chessfootball/v2/room/${roomCode}`;

    this.connectBroker(
      0,
      () => {
        if (!this.client) return;
        this.client.subscribe(this.topic, { qos: 1 }, (err) => {
          if (err) {
            this.callbacks?.onError('Lỗi khi mở phòng trên máy chủ!');
            return;
          }
          onRoomCreated(roomCode);
          this.callbacks?.onStatusUpdate?.('🟢 Phòng đã mở! Đang chờ đối thủ tham gia...');
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
  public joinRoom(roomCode: string) {
    this.cleanup();
    this.isHost = false;
    this.myRole = 'black';
    const cleanRoomCode = roomCode.trim().toLowerCase();
    this.roomId = cleanRoomCode;
    this.topic = `chessfootball/v2/room/${cleanRoomCode}`;

    this.callbacks?.onStatusUpdate?.('Đang kết nối tới máy chủ...');

    this.connectBroker(
      0,
      () => {
        if (!this.client) return;
        this.client.subscribe(this.topic, { qos: 1 }, (err) => {
          if (err) {
            this.callbacks?.onError('Lỗi tham gia phòng!');
            return;
          }

          this.callbacks?.onStatusUpdate?.('Đang gửi yêu cầu vào phòng tới Chủ phòng...');

          // Send JOIN_REQUEST repeatedly until host responds
          const sendJoin = () => {
            if (this.isConnectedToPeer) return;
            this.sendPacket({
              type: 'JOIN_REQUEST',
              senderId: this.myClientId,
            });
          };

          sendJoin();
          this.joinInterval = window.setInterval(sendJoin, 1200);

          // Timeout check
          this.joinTimeoutTimer = window.setTimeout(() => {
            if (!this.isConnectedToPeer) {
              if (this.joinInterval) {
                clearInterval(this.joinInterval);
                this.joinInterval = null;
              }
              this.callbacks?.onError('Không tìm thấy Chủ phòng hoặc Chủ phòng chưa trực tuyến. Vui lòng kiểm tra lại mã phòng!');
            }
          }, 12000);
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
      // Host receives join request from guest -> Accept and trigger connected
      if (!this.isConnectedToPeer) {
        this.isConnectedToPeer = true;
        if (this.callbacks) {
          this.callbacks.onConnected(this.roomId!, 'white');
        }
      }
      this.sendPacket({
        type: 'JOIN_ACCEPT',
        hostId: this.myClientId,
        board: (window as any).__CHESS_FOOTBALL_BOARD_STATE__ || undefined,
      });
      return;
    }

    if (packet.type === 'JOIN_ACCEPT' && !this.isHost) {
      // Guest receives join accept from host
      if (this.joinInterval) {
        clearInterval(this.joinInterval);
        this.joinInterval = null;
      }
      if (this.joinTimeoutTimer) {
        clearTimeout(this.joinTimeoutTimer);
        this.joinTimeoutTimer = null;
      }
      if (!this.isConnectedToPeer) {
        this.isConnectedToPeer = true;
        if (this.callbacks) {
          this.callbacks.onConnected(this.roomId!, 'black');
          if (packet.board) {
            this.callbacks.onPacketReceived({
              type: 'SYNC_STATE',
              board: packet.board,
              senderId: packet.hostId,
            });
          }
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
    if (this.joinTimeoutTimer) {
      clearTimeout(this.joinTimeoutTimer);
      this.joinTimeoutTimer = null;
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
