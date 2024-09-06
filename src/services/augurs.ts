// @ts-ignore no-default-export
import worker from 'workerize-loader?name=augurs&ready!./augursWorker';

export const augurs = worker();
