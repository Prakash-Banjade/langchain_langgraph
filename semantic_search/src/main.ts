import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SemanticSearchService } from './semantic-search/semantic-search.service';
import { join } from 'path';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);

  const semanticSearch = app.get(SemanticSearchService);
  await semanticSearch.load({ filePath: join(__dirname, "data", "amrita.pdf") })

  const result = await semanticSearch.search({ query: "What are her primary skills?" });
  console.log(result);

  await app.close();
}

bootstrap();
