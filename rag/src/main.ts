import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ChatGoogleService } from './chat-google/chat-google.service';
import * as readline from 'readline/promises';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);

  const chatService = app.get(ChatGoogleService);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  while (true) {
    const userInput = await rl.question("You: ");
    if (userInput === "/bye") break;

    const result = await chatService.query(userInput);
    console.log("AI: ", result);
  }

  rl.close();
  
  await app.close();
}

bootstrap();
