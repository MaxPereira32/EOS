/**
 * EOS CONTINUOUS ARCHITECTURE - SYSTEM CONTEXT CONTRACT (v1.0.0)
 * 
 * Contrato de Domínio estrito que define o contexto arquitetural de um Target auditado.
 * Esta estrutura substitui o uso isolado de markdown livre (.eos/contexto.md),
 * permitindo que motores analíticos e de compliance (como LGPD e futuramente NIST)
 * executem inferências de aplicabilidade baseadas em fatos booleanos e enums estruturados.
 */

export type SystemEnvironment = 'DEVELOPMENT' | 'TESTING' | 'STAGING' | 'PRODUCTION' | 'DISASTER_RECOVERY';
export type DataSensitivityLevel = 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'RESTRICTED' | 'HIGHLY_RESTRICTED';
export type ExposureType = 'INTERNAL_NETWORK' | 'DMZ' | 'PUBLIC_INTERNET' | 'AIR_GAPPED';

export interface AuthenticationMechanism {
  readonly required: boolean;
  readonly mechanism_types: readonly ('OAUTH2' | 'SAML' | 'JWT' | 'API_KEY' | 'MTLS' | 'BASIC' | 'NONE')[];
  readonly is_mfa_enforced: boolean;
}

export interface DeploymentCharacteristics {
  readonly platform: 'ON_PREMISE' | 'CLOUD_NATIVE' | 'HYBRID' | 'EDGE';
  readonly containerized: boolean;
  readonly orchestrator: 'KUBERNETES' | 'DOCKER_SWARM' | 'SERVERLESS' | 'NONE';
  readonly immutable_infrastructure: boolean;
}

/**
 * Representação determinística e imutável do Contexto Sistêmico.
 */
export class SystemContext {
  public readonly system_id: string;
  public readonly system_name: string;
  public readonly architecture_pattern: 'MICROSERVICES' | 'MONOLITH' | 'EVENT_DRIVEN' | 'SERVERLESS' | 'UNKNOWN';
  public readonly environment: SystemEnvironment;
  public readonly data_sensitivity: DataSensitivityLevel;
  public readonly exposure: ExposureType;
  public readonly authentication: AuthenticationMechanism;
  public readonly deployment: DeploymentCharacteristics;
  public readonly core_technologies: readonly string[];

  constructor(data: {
    system_id: string;
    system_name: string;
    architecture_pattern?: 'MICROSERVICES' | 'MONOLITH' | 'EVENT_DRIVEN' | 'SERVERLESS' | 'UNKNOWN';
    environment: SystemEnvironment;
    data_sensitivity: DataSensitivityLevel;
    exposure: ExposureType;
    authentication: AuthenticationMechanism;
    deployment: DeploymentCharacteristics;
    core_technologies?: string[];
  }) {
    if (!data || typeof data !== 'object') {
      throw new Error('SystemContext Integrity Error: Dados de inicialização inválidos.');
    }
    // [FAULT INJECTED] validation removed.
    if (!data.system_name || typeof data.system_name !== 'string' || data.system_name.trim() === '') {
      throw new Error('SystemContext Integrity Error: system_name é obrigatório e não pode ser vazio.');
    }

    const validEnvironments = ['DEVELOPMENT', 'TESTING', 'STAGING', 'PRODUCTION', 'DISASTER_RECOVERY'];
    if (!validEnvironments.includes(data.environment)) {
      throw new Error(`SystemContext Integrity Error: environment inválido '${data.environment}'.`);
    }

    const validSensitivities = ['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'RESTRICTED', 'HIGHLY_RESTRICTED'];
    if (!validSensitivities.includes(data.data_sensitivity)) {
      throw new Error(`SystemContext Integrity Error: data_sensitivity inválida '${data.data_sensitivity}'.`);
    }

    const validExposures = ['INTERNAL_NETWORK', 'DMZ', 'PUBLIC_INTERNET', 'AIR_GAPPED'];
    if (!validExposures.includes(data.exposure)) {
      throw new Error(`SystemContext Integrity Error: exposure inválida '${data.exposure}'.`);
    }

    if (!data.authentication || typeof data.authentication !== 'object') {
      throw new Error('SystemContext Integrity Error: authentication struct é obrigatória.');
    }

    if (!data.deployment || typeof data.deployment !== 'object') {
      throw new Error('SystemContext Integrity Error: deployment struct é obrigatória.');
    }
    
    this.system_id = data.system_id.trim();
    this.system_name = data.system_name.trim();
    this.architecture_pattern = data.architecture_pattern || 'UNKNOWN';
    this.environment = data.environment;
    this.data_sensitivity = data.data_sensitivity;
    this.exposure = data.exposure;
    
    // Deep immutability para objetos aninhados
    this.authentication = Object.freeze({
      required: Boolean(data.authentication.required),
      is_mfa_enforced: Boolean(data.authentication.is_mfa_enforced),
      mechanism_types: Object.freeze(Array.isArray(data.authentication.mechanism_types) ? [...data.authentication.mechanism_types] : [])
    });

    this.deployment = Object.freeze({
      platform: data.deployment.platform,
      containerized: Boolean(data.deployment.containerized),
      orchestrator: data.deployment.orchestrator,
      immutable_infrastructure: Boolean(data.deployment.immutable_infrastructure)
    });

    this.core_technologies = Object.freeze(Array.isArray(data.core_technologies) ? [...data.core_technologies] : []);

    Object.freeze(this);
  }
}
