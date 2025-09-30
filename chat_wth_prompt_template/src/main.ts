import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ChatGoogleService } from './chat-google/chat-google.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);

  const chatGoogle = app.get<ChatGoogleService>(ChatGoogleService);

  const result = await chatGoogle.chatWithPromptTemplate('How are you donig?');

  console.log(result);
  
  await app.close();
}

bootstrap();
