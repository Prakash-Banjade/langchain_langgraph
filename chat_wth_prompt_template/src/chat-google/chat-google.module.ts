import { Module } from '@nestjs/common';
import { ChatGoogleService } from './chat-google.service';

@Module({
  providers: [ChatGoogleService]
})
export class ChatGoogleModule { }
