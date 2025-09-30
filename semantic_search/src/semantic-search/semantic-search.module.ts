import { Module } from '@nestjs/common';
import { SemanticSearchService } from './semantic-search.service';

@Module({
  providers: [SemanticSearchService]
})
export class SemanticSearchModule {}
