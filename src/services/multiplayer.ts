import { Peer, DataConnection } from 'peerjs';
import { BoardState, TeamColor } from '@/engine/types';

export type NetworkPacket =
  | { type: 'SYNC_STATE'; board: BoardState }
  | { type: 'EMOTE'; emoji: string; team: TeamColor }
  | { type: 'RESET_REQUEST' }
  | { type: 'CHAT'; message: string; team: TeamColor };

export interface MultiplayerCallbacks {
  onConnected: (peerId: string, role: TeamColor) => void;
  onDisconnected: () => void;
  onPacketReceived: (packet: NetworkPacket) => void;
  onError: (errorMsg: string) => void;
}

class MultiplayerService {
  private peer: Peer | null = null;
  private connection: DataConnection | null = null;
  private callbacks: MultiplayerCallbacks | null = null;
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

    this.peer = new Peer(peerId, {
      debug: 1,
    });

    this.peer.on('open', (id) => {
      this.roomId = id;
      onRoomCreated(id);
    });

    this.peer.on('connection', (conn) => {
      this.connection = conn;
      this.setupConnectionHandlers(conn);
      if (this.callbacks) {
        this.callbacks.onConnected(conn.peer, 'white');
      }
    });

    this.peer.on('error', (err) => {
      console.error('Peer error:', err);
      if (this.callbacks) {
        this.callbacks.onError(err.message || 'Lỗi kết nối phòng');
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

    this.peer = new Peer({
      debug: 1,
    });

    this.peer.on('open', () => {
      if (!this.peer || !this.roomId) return;
      const conn = this.peer.connect(this.roomId, {
        reliable: true,
      });

      this.connection = conn;
      this.setupConnectionHandlers(conn);

      conn.on('open', () => {
        onJoined();
        if (this.callbacks) {
          this.callbacks.onConnected(this.roomId!, 'black');
        }
      });
    });

    this.peer.on('error', (err) => {
      console.error('Peer error on join:', err);
      if (this.callbacks) {
        this.callbacks.onError('Không tìm thấy phòng hoặc phòng đã đầy!');
      }
    });
  }

  private setupConnectionHandlers(conn: DataConnection) {
    conn.on('data', (data) => {
      try {
        const packet = data as NetworkPacket;
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
      this.connection.send(packet);
    }
  }

  public cleanup() {
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
