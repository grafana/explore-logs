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

  public setPatternsCount(count: number) {
    if (!this.serviceSceneState) {
      this.serviceSceneState = {};
    }

    this.serviceSceneState.patternsCount = count;
  }

  public setLabelsCount(count: number) {
    if (!this.serviceSceneState) {
      this.serviceSceneState = {};
    }

    this.serviceSceneState.labelsCount = count;
  }

  public setFieldsCount(count: number) {
    if (!this.serviceSceneState) {
      this.serviceSceneState = {};
    }

    this.serviceSceneState.fieldsCount = count;
  }

  public setServiceSceneState(state: ServiceSceneCustomState) {
    this.serviceSceneState = {
      fields: state.fields,
      patternsCount: state.patternsCount,
      labelsCount: state.labelsCount,
      fieldsCount: state.fieldsCount,
      loading: state.loading,
    };
  }
}

export function getMetadataService(): MetadataService {
  return metadataService;
}
