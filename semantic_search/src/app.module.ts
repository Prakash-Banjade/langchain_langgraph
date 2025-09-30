import { Module } from '@nestjs/common';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { SemanticSearchModule } from './semantic-search/semantic-search.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    SemanticSearchModule
  ],
  providers: [AppService],
})
export class AppModule { }
