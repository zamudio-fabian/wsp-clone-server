import { Inject } from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { LocalAuth } from 'whatsapp-web.js';

const { Client, Events } = require("whatsapp-web.js");


@WebSocketGateway(81, {
  cors: { origin: '*' },
})
export class ChatGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{

  constructor(){
  }

  @WebSocketServer() server: Server;

  clients = {};

  clientSockets = {};

  /*******************************************************************
   * 
   * GENERICS
   * 
   *******************************************************************/

  afterInit(server: any) {
  }

  handleDisconnect(client: any) {
    console.log(client.id + ' connection close');
    if(this.clients[this.clientSockets[client.id]]){
      this.clients[this.clientSockets[client.id]].destroy();
    }
  }

  handleConnection(client: any, ...args: any[]) {
    console.log(client.id + ' connection start');
  }



  /*******************************************************************
   * 
   * LISTENERS CLIENT
   * 
   *******************************************************************/

  @SubscribeMessage('start')
  handleStart(client: Socket, payload: { clientId: string },) {
    const { clientId } = payload;
    console.log(clientId + ' Iniciando cliente ');
    this.startWsp(clientId);
    this.clientSockets[client.id] = clientId;
    client.join(`room_${clientId}`);
  }

  @SubscribeMessage('get_chats')
  async handleGetChats(client: Socket, payload: { clientId: string; chatId: any },) {
    const { clientId, chatId } = payload;
    const chats = await this.clients[clientId].getChats();
    this.server.to(`room_${clientId}`).emit('incoming_chats', chats);
  }

  @SubscribeMessage('get_chat_by_id')
  async handleGetChatById(client: Socket, payload: { clientId: string; chatId: any },) {
    const { clientId, chatId } = payload;
    if(this.clients[clientId]){
      const chat = await this.clients[clientId].getChatById(chatId._serialized);
      const messages = await chat.fetchMessages({limit:10, fromMe: undefined});
      this.server.to(`room_${clientId}`).emit('incoming_chat_by_id', { chat, messages } );
    }
  }

  @SubscribeMessage('send_message') //TODO Backend
  handleIncommingMessage(
    client: Socket,
    payload: { clientId: string; chatId: any; message: string },
  ) {
    const { clientId, chatId, message } = payload;
    this.clients[clientId].sendMessage(chatId._serialized, message);
  }

   /*******************************************************************
   * 
   * LISTENERS WSP
   * 
   *******************************************************************/

  startWsp(clientId: string) {

    this.clients[clientId] = new Client({
      authStrategy: new LocalAuth({ clientId })
    });
    
    this.clients[clientId].on("authenticated", (e) => {
      console.log("authenticated");
    });
    
    this.clients[clientId].on("auth_failure", (e) => {
      console.log("auth_failure");
    });
    
    this.clients[clientId].on("disconnected", (e) => {
      console.log("disconnected");
    });

    this.clients[clientId].on("qr", (qr) => {
      console.log(clientId + ' QR generado ');
      this.server.to(`room_${clientId}`).emit('incoming_qr',qr);
    });
    
    this.clients[clientId].on("ready", () => {
      console.log(clientId + ' ready ');
      this.server.to(`room_${clientId}`).emit('incoming_start');
    });

    this.clients[clientId].on("message_create", message => {
      this.server.to(`room_${clientId}`).emit('incoming_message', message);
    });
     


    this.clients[clientId].initialize();
  }


   /*******************************************************************
   * 
   * AUX
   * 
   *******************************************************************/

}
