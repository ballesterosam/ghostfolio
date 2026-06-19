import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { IntegrationProvider } from '@prisma/client';

import { IntegrationProviderInterface } from './interfaces/integration-provider.interface';
import { EtoroProvider } from './providers/etoro/etoro.provider';
import { IndexaCapitalProvider } from './providers/indexa-capital/indexa-capital.provider';

@Injectable()
export class IntegrationProviderRegistry {
  private readonly providers = new Map<
    IntegrationProvider,
    IntegrationProviderInterface
  >();

  public constructor(
    private readonly indexaCapitalProvider: IndexaCapitalProvider,
    private readonly etoroProvider: EtoroProvider
  ) {
    this.providers.set(
      IntegrationProvider.INDEXA_CAPITAL,
      this.indexaCapitalProvider
    );
    this.providers.set(IntegrationProvider.ETORO, this.etoroProvider);
  }

  public getProvider(
    provider: IntegrationProvider
  ): IntegrationProviderInterface {
    const providerInstance = this.providers.get(provider);

    if (!providerInstance) {
      throw new InternalServerErrorException(
        `Provider ${provider} not registered`
      );
    }

    return providerInstance;
  }
}
