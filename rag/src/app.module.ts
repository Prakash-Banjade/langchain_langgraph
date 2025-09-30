import { Module } from '@nestjs/common';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { ChatGoogleModule } from './chat-google/chat-google.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ChatGoogleModule,
  ],
  providers: [AppService],
})
export class AppModule { }
