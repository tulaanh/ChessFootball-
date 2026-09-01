import { Peer, DataConnection } from 'peerjs';
import { BoardState, TeamColor } from '@/engine/types';

export type NetworkPacket =
  | { type: 'SYNC_STATE'; board: BoardState }
  | { type: 'EMOTE'; emoji: string; team: TeamColor }
  | { type: 'RESET_REQUEST' }
  | { type: 'PING' }
  | { type: 'PONG' }
  | { type: 'CHAT'; message: string; team: TeamColor };

export interface MultiplayerCallbacks {
  onConnected: (peerId: string, role: TeamColor) => void;
  onDisconnected: () => void;
  onPacketReceived: (packet: NetworkPacket) => void;
  onError: (errorMsg: string) => void;
  onStatusUpdate?: (status: string) => void;
}

export const PEER_CONFIG = {
  debug: 1,
  config: {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' },
      { urls: 'stun:stun.cloudflare.com:3478' },
      { urls: 'stun:stun.services.mozilla.com' },
      { urls: 'stun:global.stun.twilio.com:3478' },
      { urls: 'stun:stun.nextcloud.com:443' },
      // OpenRelay Public TURN / STUN for NAT traversal across different ISPs / 4G
      {
        urls: 'turn:openrelay.metered.ca:80',
        username: 'openrelayproject',
        credential: 'openrelayproject',
      },
      {
        urls: 'turn:openrelay.metered.ca:443',
        username: 'openrelayproject',
        credential: 'openrelayproject',
      },
      {
        urls: 'turn:openrelay.metered.ca:443?transport=tcp',
        username: 'openrelayproject',
        credential: 'openrelayproject',
      },
    ],
    iceCandidatePoolSize: 10,
  },
};

class MultiplayerService {
  private peer: Peer | null = null;
  private connection: DataConnection | null = null;
  private callbacks: MultiplayerCallbacks | null = null;
  private connectTimeoutTimer: number | null = null;
  public myRole: TeamColor | null = null;
  public roomId: string | null = null;
  public isHost: boolean = false;

  public init(callbacks: MultiplayerCallbacks) {
    this.callbacks = callbacks;
  }

  /**
   * Host creates a new room with a random 6-digit room code
   */
  public createRoom(onRoomCreated: (code: string) => void) {
    this.cleanup();
    this.isHost = true;
    this.myRole = 'white';

    const randomSuffix = Math.floor(100000 + Math.random() * 900000);
    const peerId = `cf-${randomSuffix}`;

    this.peer = new Peer(peerId, PEER_CONFIG);

    this.peer.on('open', (id) => {
      this.roomId = id;
      onRoomCreated(id);
    });

    this.peer.on('connection', (conn) => {
      this.connection = conn;
      this.setupConnectionHandlers(conn, 'white');
    });

    this.peer.on('error', (err) => {
      console.error('Peer host error:', err);
      if (this.callbacks) {
        this.callbacks.onError(err.message || 'Lỗi khởi tạo phòng');
      }
    });
  }

  /**
   * Guest joins an existing room by room code
   */
  public joinRoom(roomCode: string, onJoined: () => void) {
    this.cleanup();
    this.isHost = false;
    this.myRole = 'black';
    this.roomId = roomCode.trim().toLowerCase();

    this.peer = new Peer(PEER_CONFIG);

    if (this.callbacks?.onStatusUpdate) {
      this.callbacks.onStatusUpdate('Đang tìm kiếm máy chủ đối thủ...');
    }

    this.peer.on('open', () => {
      if (!this.peer || !this.roomId) return;

      if (this.callbacks?.onStatusUpdate) {
        this.callbacks.onStatusUpdate('Đang thiết lập cầu nối P2P & STUN/TURN Relay...');
      }

      const conn = this.peer.connect(this.roomId, {
        reliable: true,
      });

      this.connection = conn;
      this.setupConnectionHandlers(conn, 'black', onJoined);

      // Set timeout for connection
      if (this.connectTimeoutTimer) clearTimeout(this.connectTimeoutTimer);
      this.connectTimeoutTimer = window.setTimeout(() => {
        if (!conn.open) {
          if (this.callbacks?.onStatusUpdate) {
            this.callbacks.onStatusUpdate('Đang chuyển hướng qua TURN Relay vượt tường lửa NAT...');
          }
        }
      }, 7000);
    });

    this.peer.on('error', (err) => {
      console.error('Peer error on join:', err);
      if (this.callbacks) {
        this.callbacks.onError('Không tìm thấy phòng hoặc mã phòng không đúng!');
      }
    });
  }

  private setupConnectionHandlers(conn: DataConnection, role: TeamColor, onReady?: () => void) {
    const handleOpen = () => {
      if (this.connectTimeoutTimer) {
        clearTimeout(this.connectTimeoutTimer);
        this.connectTimeoutTimer = null;
      }
      if (onReady) onReady();
      if (this.callbacks) {
        this.callbacks.onConnected(conn.peer, role);
      }
      // Send handshake ping
      conn.send({ type: 'PING' });
    };

    if (conn.open) {
      handleOpen();
    } else {
      conn.on('open', handleOpen);
    }

    conn.on('data', (data) => {
      try {
        const packet = data as NetworkPacket;
        if (packet.type === 'PING') {
          conn.send({ type: 'PONG' });
          return;
        }
        if (packet.type === 'PONG') {
          return;
        }
        if (this.callbacks) {
          this.callbacks.onPacketReceived(packet);
        }
      } catch (e) {
        console.error('Failed to parse network packet:', e);
      }
    });

    conn.on('close', () => {
      if (this.callbacks) {
        this.callbacks.onDisconnected();
      }
    });

    conn.on('error', (err) => {
      console.error('Connection error:', err);
      if (this.callbacks) {
        this.callbacks.onError('Lỗi đường truyền mạng');
      }
    });
  }

  public sendPacket(packet: NetworkPacket) {
    if (this.connection && this.connection.open) {
      try {
        this.connection.send(packet);
      } catch (e) {
        console.error('Send packet error:', e);
      }
    }
  }

  public cleanup() {
    if (this.connectTimeoutTimer) {
      clearTimeout(this.connectTimeoutTimer);
      this.connectTimeoutTimer = null;
    }
    if (this.connection) {
      this.connection.close();
      this.connection = null;
    }
    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }
    this.roomId = null;
    this.myRole = null;
    this.isHost = false;
  }
}

export const multiplayerService = new MultiplayerService();
