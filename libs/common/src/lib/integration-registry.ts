import { IntegrationProvider } from '@prisma/client';

import { IntegrationProviderInfo } from './interfaces/platform-integration.interface';

export const SUPPORTED_INTEGRATIONS: IntegrationProviderInfo[] = [
  {
    provider: IntegrationProvider.INDEXA_CAPITAL,
    name: 'Indexa Capital',
    url: 'https://indexacapital.com',
    description:
      'Gestor automatizado de inversiones líder en España (fondos indexados, planes de pensiones, EPSV).',
    iconKey: 'indexa-capital',
    setupSteps: [
      'Accede a tu área privada en indexacapital.com',
      'Ve a Configuración de usuario > API / Aplicaciones',
      'Genera un token de API con permisos de lectura',
      'Copia el token y pégalo a continuación'
    ],
    credentialFields: [
      {
        key: 'apiToken',
        label: 'API Token',
        type: 'password',
        placeholder: 'Token de Indexa Capital',
        helpText: 'Tu token personal de API para acceso de sólo lectura.'
      }
    ]
  }
];
