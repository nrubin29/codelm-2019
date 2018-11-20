import { Injectable } from '@angular/core';
import * as io from 'socket.io-client';
import { Observable } from 'rxjs';
import { Router } from '@angular/router';
import { environment } from '../../environments/environment';
import { Packet } from '../../../../common/src/packets/packet';

@Injectable({
  providedIn: 'root'
})
export class SocketService {
  private socket: SocketIOClient.Socket;

  constructor(private router: Router) {}

  connect(): Promise<void> {
    this.socket = io(location.protocol + '//' + location.hostname + environment.socketSuffix);

    return new Promise<void>((resolve, reject) => {
      this.socket.on('connect', () => {
        resolve();
      });
    });
  }

  on<T extends Packet>(event: string, fn: (packet: T) => void) {
    this.socket.on(event, fn);
  }

  once<T extends Packet>(event: string, fn: (packet: T) => void) {
    this.socket.once(event, fn);
  }

  off(event: string) {
    this.socket.off(event);
  }

  listenOnDisconnect() {
    this.socket.on('disconnect', () => {
      this.socket.close();
      this.router.navigate(['/disconnected']);
    });
  }

  isConnected(): boolean {
    return this.socket && this.socket.connected;
  }

  emit(packet: Packet) {
    if (!this.isConnected()) {
      throw new Error('Socket is not connected!');
    }

    this.socket.emit(packet.name, packet);
  }
}
