import { ServiceSceneCustomState, ServiceSceneState } from '../Components/ServiceScene/ServiceScene';

let metadataService: MetadataService;

export function initializeMetadataService(): void {
  if (!metadataService) {
    console.warn('INIT METADATA');
    metadataService = new MetadataService();
  }
}

export interface ServiceMetadata {
  fields?: string[];
}

export class MetadataService {
  private serviceSceneState: ServiceSceneCustomState | undefined = undefined;

  public getServiceSceneState() {
    return this.serviceSceneState;
  }

  public setServiceSceneState(state: ServiceSceneState) {
    this.serviceSceneState = {
      fields: state.fields,
      labels: state.labels,
      patterns: state.patterns,
      fieldsCount: state.fieldsCount,
      loading: state.loading,
    };
  }
}

export function getMetadataService(): MetadataService {
  return metadataService;
}
