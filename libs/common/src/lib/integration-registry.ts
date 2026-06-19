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
  },
  {
    provider: IntegrationProvider.ETORO,
    name: 'eToro',
    url: 'https://etoro.com',
    description:
      'Broker de inversión líder global. Sincroniza automáticamente tus posiciones de acciones, ETFs y criptomonedas.',
    iconKey: 'etoro',
    setupSteps: [
      'Inicia sesión en tu cuenta de eToro.',
      'Ve a Ajustes > Trading.',
      'Crea una nueva clave de API (Create New Key).',
      'Configura el entorno en "Real Portfolio" y copia tu API Key y tu User Key.'
    ],
    credentialFields: [
      {
        key: 'apiKey',
        label: 'API Key (x-api-key)',
        type: 'password',
        placeholder: 'Tu clave de API pública',
        helpText: 'Clave pública de la aplicación provista por eToro.'
      },
      {
        key: 'userKey',
        label: 'User Key (x-user-key)',
        type: 'password',
        placeholder: 'Tu clave de cuenta de usuario',
        helpText: 'Clave privada generada en tus ajustes de trading.'
      }
    ]
  }
];
