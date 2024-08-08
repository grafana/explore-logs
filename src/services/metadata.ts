import { ServiceSceneCustomState } from '../Components/ServiceScene/ServiceScene';

let metadataService: MetadataService;

export function initializeMetadataService(): void {
  if (!metadataService) {
    metadataService = new MetadataService();
  }
}

/**
 * Singleton class for sharing state across drilldown routes with common parent scene
 */
export class MetadataService {
  private serviceSceneState: ServiceSceneCustomState | undefined = undefined;
  public getServiceSceneState() {
    return this.serviceSceneState;
  }

  public setServiceSceneState(state: ServiceSceneCustomState) {
    this.serviceSceneState = {
      fields: state.fields,
      labels: state.labels,
      patternsCount: state.patternsCount,
      fieldsCount: state.fieldsCount,
      loading: state.loading,
    };
  }
}

export function getMetadataService(): MetadataService {
  return metadataService;
}
