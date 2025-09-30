import { Module } from '@nestjs/common';
import { AppService } from './app.service';
import { ChatGoogleModule } from './chat-google/chat-google.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ChatGoogleModule
  ],
  providers: [AppService],
})
export class AppModule { }
