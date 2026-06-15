import { ConfigurationService } from '@ghostfolio/api/services/configuration/configuration.service';
import { FetchService } from '@ghostfolio/api/services/fetch/fetch.service';
import { SymbolProfileService } from '@ghostfolio/api/services/symbol-profile/symbol-profile.service';
import { AssetProfileIdentifier } from '@ghostfolio/common/interfaces';

import { HttpException, Injectable } from '@nestjs/common';
import { DataSource } from '@prisma/client';
import { StatusCodes, getReasonPhrase } from 'http-status-codes';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

@Injectable()
export class LogoService {
  public constructor(
    private readonly configurationService: ConfigurationService,
    private readonly fetchService: FetchService,
    private readonly symbolProfileService: SymbolProfileService
  ) {}

  public async getLogoByDataSourceAndSymbol({
    dataSource,
    symbol
  }: AssetProfileIdentifier) {
    if (!DataSource[dataSource]) {
      throw new HttpException(
        getReasonPhrase(StatusCodes.NOT_FOUND),
        StatusCodes.NOT_FOUND
      );
    }

    const [assetProfile] = await this.symbolProfileService.getSymbolProfiles([
      { dataSource, symbol }
    ]);

    if (!assetProfile?.url) {
      throw new HttpException(
        getReasonPhrase(StatusCodes.NOT_FOUND),
        StatusCodes.NOT_FOUND
      );
    }

    return this.getBuffer(assetProfile.url);
  }

  public async getLogoByUrl(aUrl: string) {
    if (
      aUrl === 'https://indexacapital.com' ||
      aUrl === 'https://etoro.com' ||
      aUrl === 'https://www.etoro.com'
    ) {
      try {
        const isEtoro = aUrl.includes('etoro');
        const filename = isEtoro ? 'etoro.png' : 'indexa-capital.png';
        let filePath = join(__dirname, 'assets', filename);
        if (!existsSync(filePath)) {
          filePath = join(
            process.cwd(),
            'apps',
            'api',
            'src',
            'assets',
            filename
          );
        }
        const buffer = readFileSync(filePath);
        return {
          buffer,
          type: 'image/png'
        };
      } catch (error) {
        throw new HttpException(
          getReasonPhrase(StatusCodes.NOT_FOUND),
          StatusCodes.NOT_FOUND
        );
      }
    }
    return this.getBuffer(aUrl);
  }

  private async getBuffer(aUrl: string, direct = false) {
    const url = direct
      ? aUrl
      : `https://t0.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=${aUrl}&size=64`;

    const blob = await this.fetchService
      .fetch(url, {
        headers: { 'User-Agent': 'request' },
        signal: AbortSignal.timeout(
          this.configurationService.get('REQUEST_TIMEOUT')
        )
      })
      .then((res) => res.blob());

    return {
      buffer: await blob.arrayBuffer().then((arrayBuffer) => {
        return Buffer.from(arrayBuffer);
      }),
      type: blob.type
    };
  }
}
